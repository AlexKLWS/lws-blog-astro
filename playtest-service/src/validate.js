/**
 * Input validation. Everything that reaches Firestore or the email API goes
 * through here first.
 */

// Deliberately permissive: the goal is to reject obvious junk, not to police
// exotic-but-valid addresses. Deliverability is verified by the key actually
// arriving.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class ValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const normalizeEmail = (email) => String(email).trim().toLowerCase()

/**
 * Firestore document IDs cannot contain '/', cannot be '.' or '..', and are
 * capped at 1500 bytes. A valid email never contains '/', but a hostile payload
 * might, so we guard rather than trust.
 */
export const emailToDocId = (normalizedEmail) => {
  if (normalizedEmail.includes('/') || normalizedEmail === '.' || normalizedEmail === '..') {
    throw new ValidationError('invalid_email', 'That email address is not valid.')
  }
  return normalizedEmail
}

// Campaign ids are slugs: lowercase letters, digits and hyphens.
const CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9-]{0,60}$/

export const parseSignupRequest = (body) => {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('invalid_body', 'Expected a JSON body.')
  }

  const email = normalizeEmail(body.email ?? '')
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('invalid_email', 'Please enter a valid email address.')
  }

  const name = String(body.name ?? '').trim()
  if (!name) {
    throw new ValidationError('invalid_name', 'Please tell me what to call you.')
  }
  if (name.length > 100) {
    throw new ValidationError('invalid_name', 'That name is a little too long (100 characters max).')
  }

  const campaignId = String(body.campaign ?? '').trim().toLowerCase()
  if (!CAMPAIGN_PATTERN.test(campaignId)) {
    throw new ValidationError('invalid_campaign', 'This signup form is misconfigured.')
  }

  const turnstileToken = String(body.turnstileToken ?? '').trim()

  return {
    campaignId,
    email,
    name,
    willFillForm: body.willFillForm === true,
    creditsOptIn: body.creditsOptIn === true,
    turnstileToken,
    // Hidden field: real users never see it, so anything in it means a bot.
    honeypot: String(body.website ?? '').trim(),
  }
}
