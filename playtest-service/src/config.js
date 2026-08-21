/**
 * All runtime configuration lives here so there is exactly one place to look
 * when something is misconfigured in Cloud Run.
 *
 * Note what is NOT here: anything game-specific. Game name, Steam URL, sender
 * address and feedback form live in Firestore, one document per campaign, so
 * adding a future game never requires touching this service.
 *
 * Secrets (RESEND_API_KEY, TURNSTILE_SECRET_KEY) are injected by Secret Manager.
 */

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const optional = (name, fallback) => process.env[name] || fallback

export const PROJECT_ID = optional('GOOGLE_CLOUD_PROJECT', 'player-signup-automation')

export const COLLECTIONS = {
  // campaigns/{campaignId}
  //   ├── keys/{keyId}
  //   └── signups/{email}
  campaigns: 'campaigns',
  keys: 'keys',
  signups: 'signups',
  rateLimits: 'rateLimits',
}

// Browsers that are allowed to call this endpoint. Anything else gets no CORS
// headers back, which stops the form from being embedded on someone else's page.
export const allowedOrigins = optional(
  'ALLOWED_ORIGINS',
  'https://blog.longwintershadows.com,http://localhost:4321',
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Max signups accepted from a single IP inside the window, counted across all
// campaigns. Turnstile is the real defence; this is the backstop.
export const rateLimit = {
  maxPerWindow: Number(optional('RATE_LIMIT_MAX', '5')),
  windowMs: Number(optional('RATE_LIMIT_WINDOW_MS', String(24 * 60 * 60 * 1000))),
}

// Used only when a campaign document does not override them.
export const emailDefaults = {
  from: optional('FROM_EMAIL', 'Long Winter Shadows <playtest@longwintershadows.com>'),
  replyTo: optional('REPLY_TO_EMAIL', 'alexkorzh7@gmail.com'),
  developer: optional('DEFAULT_DEVELOPER', 'Long Winter Shadows'),
  signOff: optional('DEFAULT_SIGN_OFF', 'Alex'),
  siteName: optional('SITE_NAME', 'longwintershadows.com'),
}

export const secrets = {
  get resendApiKey() {
    return required('RESEND_API_KEY')
  },
  get turnstileSecretKey() {
    return required('TURNSTILE_SECRET_KEY')
  },
}

// Set to '1' locally to skip Turnstile verification while developing.
export const skipTurnstile = optional('SKIP_TURNSTILE', '') === '1'
