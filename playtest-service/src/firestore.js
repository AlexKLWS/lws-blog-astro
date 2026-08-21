import { Firestore, FieldPath, FieldValue } from '@google-cloud/firestore'
import { createHash } from 'node:crypto'

import { COLLECTIONS, PROJECT_ID, rateLimit } from './config.js'
import { emailToDocId } from './validate.js'

let firestore

export const getDb = () => {
  if (!firestore) {
    firestore = new Firestore({ projectId: PROJECT_ID, ignoreUndefinedProperties: true })
  }
  return firestore
}

export class NoKeysAvailableError extends Error {
  constructor(campaignId) {
    super(`No keys remain for campaign "${campaignId}".`)
    this.code = 'no_keys'
  }
}

export class RateLimitedError extends Error {
  constructor() {
    super('Too many signups from this address.')
    this.code = 'rate_limited'
  }
}

const hashIp = (ip) => createHash('sha256').update(String(ip)).digest('hex').slice(0, 32)

// Keys and signups are subcollections of the campaign, so campaigns are fully
// isolated: importing or exhausting one game's keys cannot affect another.
export const keysCollection = (campaignId) =>
  getDb().collection(COLLECTIONS.campaigns).doc(campaignId).collection(COLLECTIONS.keys)

export const signupsCollection = (campaignId) =>
  getDb().collection(COLLECTIONS.campaigns).doc(campaignId).collection(COLLECTIONS.signups)

/**
 * Per-IP backstop behind Turnstile, counted across all campaigns. Stores only a
 * hash of the IP so the collection never becomes a pile of raw addresses.
 */
export const enforceRateLimit = async (ip) => {
  if (!ip) return

  const db = getDb()
  const ref = db.collection(COLLECTIONS.rateLimits).doc(hashIp(ip))
  const now = Date.now()

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const windowStart = snapshot.exists ? snapshot.get('windowStart') : 0
    const withinWindow = snapshot.exists && now - windowStart < rateLimit.windowMs
    const count = withinWindow ? snapshot.get('count') : 0

    if (count >= rateLimit.maxPerWindow) {
      throw new RateLimitedError()
    }

    tx.set(ref, {
      count: count + 1,
      windowStart: withinWindow ? windowStart : now,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

/**
 * Claims the next available key for this email, atomically.
 *
 * The whole point of the transaction is that two people submitting at the same
 * instant can never be handed the same key: Firestore aborts and retries the
 * loser, which then picks up the next key in the pool.
 *
 * Idempotent by email *within a campaign*. A repeat submission returns the
 * existing key rather than burning a second one — but the same person can still
 * sign up for a different game, which is what you want.
 *
 * @returns {{ signup: object, alreadyRegistered: boolean }}
 */
export const claimKeyForSignup = async ({ campaignId, email, name, willFillForm, ip, userAgent }) => {
  const db = getDb()
  const signupRef = signupsCollection(campaignId).doc(emailToDocId(email))

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(signupRef)
    if (existing.exists) {
      return { signup: { id: existing.id, ...existing.data() }, alreadyRegistered: true }
    }

    // Doc IDs are zero-padded and sequential (key-000001), so ordering by
    // document ID hands keys out in import order. Ordering by __name__ alongside
    // an equality filter is served by Firestore's automatic single-field index —
    // no composite index needed.
    const availableQuery = keysCollection(campaignId)
      .where('status', '==', 'available')
      .orderBy(FieldPath.documentId())
      .limit(1)

    const available = await tx.get(availableQuery)
    if (available.empty) {
      throw new NoKeysAvailableError(campaignId)
    }

    const keyDoc = available.docs[0]

    tx.update(keyDoc.ref, {
      status: 'claimed',
      claimedAt: FieldValue.serverTimestamp(),
      claimedBy: { email, name, willFillForm },
    })

    const signup = {
      campaignId,
      email,
      name,
      willFillForm,
      keyId: keyDoc.id,
      keyCode: keyDoc.get('code'),
      ip: ip ? hashIp(ip) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
      createdAt: FieldValue.serverTimestamp(),
      delivery: { status: 'pending', attempts: 0, lastError: null, sentAt: null },
    }

    tx.set(signupRef, signup)

    return { signup: { id: signupRef.id, ...signup }, alreadyRegistered: false }
  })
}

export const recordDeliverySuccess = async (campaignId, email) => {
  await signupsCollection(campaignId)
    .doc(emailToDocId(email))
    .update({
      'delivery.status': 'sent',
      'delivery.sentAt': FieldValue.serverTimestamp(),
      'delivery.lastError': null,
      'delivery.attempts': FieldValue.increment(1),
    })
}

export const recordDeliveryFailure = async (campaignId, email, error) => {
  await signupsCollection(campaignId)
    .doc(emailToDocId(email))
    .update({
      'delivery.status': 'failed',
      'delivery.lastError': String(error?.message || error).slice(0, 500),
      'delivery.attempts': FieldValue.increment(1),
    })
}
