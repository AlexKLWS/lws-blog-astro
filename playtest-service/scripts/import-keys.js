#!/usr/bin/env node
/**
 * Imports Steam keys from .txt files into Firestore.
 *
 *   npm run import-keys -- --campaign=distant-light-prologue ~/keys/batch1.txt
 *   npm run import-keys -- --campaign=distant-light-prologue --dry-run ~/keys/b1.txt
 *
 * Safe to re-run: keys already in Firestore are skipped, so re-importing a file
 * you've partly loaded (or that overlaps another file) adds only what's new.
 *
 * Requires GOOGLE_CLOUD_PROJECT and application-default credentials:
 *   gcloud auth application-default login
 */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

import { FieldPath } from '@google-cloud/firestore'

import { getDb, keysCollection } from '../src/firestore.js'
import { COLLECTIONS } from '../src/config.js'
import { parseArgs, requireCampaign } from './_args.js'

// Steam keys are groups of five alphanumerics; retail keys are 3 groups,
// some promo keys are 4 or 5.
const KEY_PATTERN = /\b([A-Z0-9]{5}(?:-[A-Z0-9]{5}){2,4})\b/

export const parseKeysFromFile = (contents) => {
  const found = []
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue
    const match = KEY_PATTERN.exec(line.toUpperCase())
    if (match) found.push(match[1])
  }
  return found
}

const nextSequence = async (campaignId) => {
  const snapshot = await keysCollection(campaignId)
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(1)
    .get()

  if (snapshot.empty) return 1
  const lastId = snapshot.docs[0].id
  const parsed = Number.parseInt(lastId.replace('key-', ''), 10)
  return Number.isFinite(parsed) ? parsed + 1 : 1
}

const existingCodes = async (campaignId) => {
  const snapshot = await keysCollection(campaignId).select('code').get()
  return new Set(snapshot.docs.map((doc) => doc.get('code')))
}

const main = async () => {
  const { flags, positional: files } = parseArgs(process.argv.slice(2))
  const campaignId = requireCampaign(flags)
  const dryRun = Boolean(flags['dry-run'])

  if (files.length === 0) {
    console.error('Usage: npm run import-keys -- --campaign=<id> [--dry-run] <file.txt> [more.txt ...]')
    process.exit(1)
  }

  const db = getDb()

  // Refuse to import into a campaign that does not exist, otherwise a typo in
  // --campaign silently creates an orphaned pool of keys nobody can claim.
  const campaign = await db.collection(COLLECTIONS.campaigns).doc(campaignId).get()
  if (!campaign.exists) {
    console.error(`No campaign "${campaignId}". Create it first:`)
    console.error(`  npm run create-campaign -- --campaign=${campaignId} --name="Game Title"`)
    process.exit(1)
  }

  const alreadyStored = await existingCodes(campaignId)
  let sequence = await nextSequence(campaignId)

  const toWrite = []
  const seenInThisRun = new Set()
  let skippedDuplicates = 0

  for (const file of files) {
    const contents = await readFile(file, 'utf8')
    const codes = parseKeysFromFile(contents)
    let addedFromFile = 0

    for (const code of codes) {
      if (alreadyStored.has(code) || seenInThisRun.has(code)) {
        skippedDuplicates += 1
        continue
      }
      seenInThisRun.add(code)
      toWrite.push({
        id: `key-${String(sequence).padStart(6, '0')}`,
        data: {
          code,
          batch: basename(file),
          status: 'available',
          seq: sequence,
          importedAt: new Date(),
          claimedAt: null,
          claimedBy: null,
        },
      })
      sequence += 1
      addedFromFile += 1
    }

    console.log(`${basename(file)}: found ${codes.length} keys, ${addedFromFile} new`)
  }

  console.log(`\nCampaign "${campaignId}" (${campaign.get('gameName')})`)
  console.log(`Total new keys: ${toWrite.length} (skipped ${skippedDuplicates} duplicates)`)

  if (dryRun) {
    console.log('Dry run — nothing written.')
    if (toWrite.length > 0) {
      const preview = toWrite[0]
      console.log(`First would be written as ${preview.id} -> ${preview.data.code}`)
    }
    return
  }

  if (toWrite.length === 0) return

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < toWrite.length; i += 500) {
    const batch = db.batch()
    for (const entry of toWrite.slice(i, i + 500)) {
      batch.set(keysCollection(campaignId).doc(entry.id), entry.data)
    }
    await batch.commit()
    console.log(`Committed ${Math.min(i + 500, toWrite.length)}/${toWrite.length}`)
  }

  console.log('Import complete.')
}

// Only run when executed directly, so the parser can be imported and tested.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
