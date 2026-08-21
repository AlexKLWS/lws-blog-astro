#!/usr/bin/env node
/**
 * Dumps a campaign's signups to CSV on stdout.
 *   npm run export -- --campaign=distant-light-prologue > signups.csv
 */
import { signupsCollection } from '../src/firestore.js'
import { parseArgs, requireCampaign } from './_args.js'

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const main = async () => {
  const { flags } = parseArgs(process.argv.slice(2))
  const campaignId = requireCampaign(flags)

  const snapshot = await signupsCollection(campaignId).orderBy('createdAt').get()

  const rows = [['email', 'name', 'will_fill_form', 'key_code', 'delivery_status', 'created_at']]
  for (const doc of snapshot.docs) {
    const createdAt = doc.get('createdAt')
    rows.push([
      doc.get('email'),
      doc.get('name'),
      doc.get('willFillForm') ? 'yes' : 'no',
      doc.get('keyCode'),
      doc.get('delivery.status'),
      createdAt?.toDate?.().toISOString() ?? '',
    ])
  }

  console.log(rows.map((row) => row.map(csvCell).join(',')).join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
