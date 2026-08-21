#!/usr/bin/env node
/**
 * Resends key emails for signups whose delivery failed.
 *   npm run retry-failed -- --campaign=distant-light-prologue
 *
 * Each signup keeps its originally assigned key, so retrying never consumes an
 * extra key from the pool.
 *
 * Needs RESEND_API_KEY in the environment (the same value Cloud Run uses).
 */
import { loadCampaign } from '../src/campaigns.js'
import { sendKeyEmail } from '../src/email.js'
import { recordDeliveryFailure, recordDeliverySuccess, signupsCollection } from '../src/firestore.js'
import { parseArgs, requireCampaign } from './_args.js'

const main = async () => {
  const { flags } = parseArgs(process.argv.slice(2))
  const campaignId = requireCampaign(flags)
  const campaign = await loadCampaign(campaignId)

  const snapshot = await signupsCollection(campaignId)
    .where('delivery.status', 'in', ['failed', 'pending'])
    .get()

  if (snapshot.empty) {
    console.log('Nothing to retry.')
    return
  }

  console.log(`Retrying ${snapshot.size} signup(s) for ${campaign.gameName}...`)

  for (const doc of snapshot.docs) {
    const email = doc.get('email')
    try {
      await sendKeyEmail({
        campaign,
        to: email,
        name: doc.get('name'),
        keyCode: doc.get('keyCode'),
        willFillForm: doc.get('willFillForm'),
      })
      await recordDeliverySuccess(campaignId, email)
      console.log(`  sent -> ${email}`)
    } catch (error) {
      await recordDeliveryFailure(campaignId, email, error)
      console.error(`  STILL FAILING -> ${email}: ${error.message}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
