import { COLLECTIONS, emailDefaults } from './config.js'
import { getDb } from './firestore.js'

export class UnknownCampaignError extends Error {
  constructor(campaignId) {
    super(`No campaign named "${campaignId}".`)
    this.code = 'unknown_campaign'
  }
}

export class CampaignClosedError extends Error {
  constructor(campaignId) {
    super(`Campaign "${campaignId}" is not accepting signups.`)
    this.code = 'campaign_closed'
  }
}

// Campaign docs change roughly never, so a short cache saves a Firestore read
// on every submission without making edits feel stuck.
const CACHE_TTL_MS = 60_000
const cache = new Map()

export const campaignRef = (campaignId) => getDb().collection(COLLECTIONS.campaigns).doc(campaignId)

/**
 * Loads a campaign and fills in defaults for anything it does not override.
 * Throws if the campaign is missing or closed.
 */
export const loadCampaign = async (campaignId) => {
  const cached = cache.get(campaignId)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.campaign
  }

  const snapshot = await campaignRef(campaignId).get()
  if (!snapshot.exists) {
    throw new UnknownCampaignError(campaignId)
  }

  const data = snapshot.data()
  if (data.active === false) {
    throw new CampaignClosedError(campaignId)
  }

  const campaign = {
    id: campaignId,
    gameName: data.gameName,
    developer: data.developer ?? emailDefaults.developer,
    steamAppUrl: data.steamAppUrl ?? null,
    fromEmail: data.fromEmail ?? emailDefaults.from,
    replyTo: data.replyTo ?? emailDefaults.replyTo,
    feedbackFormUrl: data.feedbackFormUrl ?? null,
    signOff: data.signOff ?? emailDefaults.signOff,
    siteName: data.siteName ?? emailDefaults.siteName,
    // Optional override; defaults to "Your <game> playtest key".
    emailSubject: data.emailSubject ?? null,
  }

  if (!campaign.gameName) {
    throw new UnknownCampaignError(campaignId)
  }

  cache.set(campaignId, { at: Date.now(), campaign })
  return campaign
}
