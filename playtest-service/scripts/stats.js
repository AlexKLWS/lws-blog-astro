#!/usr/bin/env node
/**
 * Key pool and delivery health for one campaign.
 *   npm run stats -- --campaign=distant-light-prologue
 *
 * For an overview of every campaign at once, use `npm run campaigns`.
 */
import { keysCollection, signupsCollection } from '../src/firestore.js'
import { parseArgs, requireCampaign } from './_args.js'

const main = async () => {
  const { flags } = parseArgs(process.argv.slice(2))
  const campaignId = requireCampaign(flags)

  const [available, claimed, signups] = await Promise.all([
    keysCollection(campaignId).where('status', '==', 'available').count().get(),
    keysCollection(campaignId).where('status', '==', 'claimed').count().get(),
    signupsCollection(campaignId).get(),
  ])

  const delivery = { sent: 0, pending: 0, failed: 0 }
  let willFillForm = 0
  for (const doc of signups.docs) {
    const status = doc.get('delivery.status') || 'pending'
    delivery[status] = (delivery[status] || 0) + 1
    if (doc.get('willFillForm')) willFillForm += 1
  }

  console.log(`Campaign: ${campaignId}`)
  console.log('\nKeys')
  console.log(`  available: ${available.data().count}`)
  console.log(`  claimed:   ${claimed.data().count}`)
  console.log('\nSignups')
  console.log(`  total:            ${signups.size}`)
  console.log(`  email sent:       ${delivery.sent}`)
  console.log(`  email pending:    ${delivery.pending}`)
  console.log(`  email FAILED:     ${delivery.failed}`)
  console.log(`  agreed to a form: ${willFillForm}`)

  if (delivery.failed > 0) {
    console.log(`\nRun \`npm run retry-failed -- --campaign=${campaignId}\` to resend.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
