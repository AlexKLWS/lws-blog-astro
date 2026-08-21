#!/usr/bin/env node
/**
 * Lists every campaign with its key pool status.
 *   npm run campaigns
 */
import { COLLECTIONS } from '../src/config.js'
import { getDb, keysCollection, signupsCollection } from '../src/firestore.js'

const main = async () => {
  const snapshot = await getDb().collection(COLLECTIONS.campaigns).get()

  if (snapshot.empty) {
    console.log('No campaigns yet. Create one with `npm run create-campaign`.')
    return
  }

  for (const doc of snapshot.docs) {
    const [available, claimed, signups] = await Promise.all([
      keysCollection(doc.id).where('status', '==', 'available').count().get(),
      keysCollection(doc.id).where('status', '==', 'claimed').count().get(),
      signupsCollection(doc.id).count().get(),
    ])

    const state = doc.get('active') === false ? 'CLOSED' : 'open'
    console.log(`${doc.id}  [${state}]`)
    console.log(`  game:      ${doc.get('gameName')}`)
    console.log(`  keys:      ${available.data().count} available / ${claimed.data().count} claimed`)
    console.log(`  signups:   ${signups.data().count}`)
    console.log(`  feedback:  ${doc.get('feedbackFormUrl') || '(not set)'}`)
    console.log('')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
