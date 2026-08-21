#!/usr/bin/env node
/**
 * Creates or updates a campaign — this is the whole "adding a new game" step.
 *
 *   npm run create-campaign -- --campaign=my-next-game \
 *     --name="My Next Game" \
 *     --steam=https://store.steampowered.com/app/123456/My_Next_Game/ \
 *     --feedback=https://forms.gle/XXXX
 *
 * Re-running merges, so it doubles as "edit a campaign":
 *   npm run create-campaign -- --campaign=my-next-game --feedback=https://forms.gle/NEW
 *   npm run create-campaign -- --campaign=my-next-game --close
 *   npm run create-campaign -- --campaign=my-next-game --open
 */
import { COLLECTIONS } from '../src/config.js'
import { getDb } from '../src/firestore.js'
import { parseArgs, requireCampaign } from './_args.js'

const main = async () => {
  const { flags } = parseArgs(process.argv.slice(2))
  const campaignId = requireCampaign(flags)

  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(campaignId)) {
    console.error('Campaign id must be a lowercase slug, e.g. "distant-light-prologue".')
    process.exit(1)
  }

  const ref = getDb().collection(COLLECTIONS.campaigns).doc(campaignId)
  const existing = await ref.get()

  const update = {}
  if (flags.name) update.gameName = flags.name
  if (flags.steam) update.steamAppUrl = flags.steam
  if (flags.feedback) update.feedbackFormUrl = flags.feedback
  if (flags.developer) update.developer = flags.developer
  if (flags.from) update.fromEmail = flags.from
  if (flags['reply-to']) update.replyTo = flags['reply-to']
  if (flags.subject) update.emailSubject = flags.subject
  if (flags['sign-off']) update.signOff = flags['sign-off']
  if (flags.site) update.siteName = flags.site
  if (flags.close) update.active = false
  if (flags.open) update.active = true

  if (!existing.exists) {
    if (!update.gameName) {
      console.error('A new campaign needs --name "Game Title".')
      process.exit(1)
    }
    update.active = update.active ?? true
    update.createdAt = new Date()
  }

  if (Object.keys(update).length === 0) {
    console.error('Nothing to change. Pass at least one field.')
    process.exit(1)
  }

  await ref.set(update, { merge: true })

  const after = await ref.get()
  console.log(`${existing.exists ? 'Updated' : 'Created'} campaign "${campaignId}":`)
  console.log(JSON.stringify(after.data(), null, 2))

  if (!existing.exists) {
    console.log(`\nNext: import keys for it —`)
    console.log(`  npm run import-keys -- --campaign=${campaignId} ~/keys/batch1.txt`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
