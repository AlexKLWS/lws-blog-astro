import functions from '@google-cloud/functions-framework'

import { CampaignClosedError, UnknownCampaignError, loadCampaign } from './src/campaigns.js'
import { allowedOrigins } from './src/config.js'
import { sendKeyEmail } from './src/email.js'
import {
  NoKeysAvailableError,
  RateLimitedError,
  claimKeyForSignup,
  enforceRateLimit,
  recordDeliveryFailure,
  recordDeliverySuccess,
} from './src/firestore.js'
import { ValidationError, parseSignupRequest } from './src/validate.js'

const applyCors = (req, res) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  res.set('Access-Control-Max-Age', '3600')
}

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || null
}

functions.http('playtestSignup', async (req, res) => {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  let signupRequest
  try {
    signupRequest = parseSignupRequest(req.body)
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ ok: false, error: error.code, message: error.message })
      return
    }
    throw error
  }

  const { campaignId, email, name, willFillForm, creditsOptIn, turnstileToken, honeypot } = signupRequest

  // A filled honeypot means a bot. Answer with a plausible success so it has no
  // signal to learn from, but hand out nothing.
  if (honeypot) {
    console.warn('Honeypot triggered', { campaignId, email })
    res.status(200).json({ ok: true, alreadyRegistered: false })
    return
  }

  const ip = clientIp(req)

  // Imported lazily so a missing TURNSTILE_SECRET_KEY surfaces as a 500 with a
  // clear message rather than crashing the container at startup.
  const { verifyTurnstile } = await import('./src/turnstile.js')
  const humanVerified = await verifyTurnstile(turnstileToken, ip)
  if (!humanVerified) {
    res.status(400).json({
      ok: false,
      error: 'turnstile_failed',
      message: "The anti-bot check didn't go through. Please reload the page and try again.",
    })
    return
  }

  let campaign
  try {
    campaign = await loadCampaign(campaignId)
  } catch (error) {
    if (error instanceof UnknownCampaignError) {
      console.error('Signup for unknown campaign', { campaignId })
      res.status(404).json({
        ok: false,
        error: 'unknown_campaign',
        message: 'This signup form is misconfigured. Please let me know you saw this.',
      })
      return
    }
    if (error instanceof CampaignClosedError) {
      res.status(403).json({
        ok: false,
        error: 'campaign_closed',
        message: 'Signups for this playtest are closed. Thanks for the interest!',
      })
      return
    }
    throw error
  }

  let claim
  try {
    await enforceRateLimit(ip)
    claim = await claimKeyForSignup({
      campaignId,
      email,
      name,
      willFillForm,
      creditsOptIn,
      ip,
      userAgent: req.headers['user-agent'],
    })
  } catch (error) {
    if (error instanceof RateLimitedError) {
      res.status(429).json({
        ok: false,
        error: 'rate_limited',
        message: "That's a lot of requests from one place. Try again tomorrow, or email me directly.",
      })
      return
    }
    if (error instanceof NoKeysAvailableError) {
      console.error('Key pool exhausted', { campaignId, email })
      res.status(409).json({
        ok: false,
        error: 'no_keys',
        message: "I've run out of keys for now. Email me and I'll add you to the waiting list.",
      })
      return
    }
    console.error('Failed to claim key', { campaignId }, error)
    res.status(500).json({ ok: false, error: 'claim_failed', message: 'Something broke on my end. Please try again shortly.' })
    return
  }

  const { signup, alreadyRegistered } = claim

  try {
    await sendKeyEmail({
      campaign,
      to: email,
      name: signup.name,
      keyCode: signup.keyCode,
      willFillForm: signup.willFillForm,
      creditsOptIn: signup.creditsOptIn,
    })
    await recordDeliverySuccess(campaignId, email)
  } catch (error) {
    console.error('Failed to send key email', { campaignId, email, keyId: signup.keyId }, error)
    await recordDeliveryFailure(campaignId, email, error)
    // The key stays assigned to this email on purpose: `npm run retry-failed`
    // resends the same key rather than burning a second one.
    res.status(502).json({
      ok: false,
      error: 'email_failed',
      message: "Your key is reserved, but the email didn't go out. I'll send it manually — no need to sign up again.",
    })
    return
  }

  console.log('Key delivered', { campaignId, email, keyId: signup.keyId, alreadyRegistered })
  res.status(200).json({ ok: true, alreadyRegistered })
})
