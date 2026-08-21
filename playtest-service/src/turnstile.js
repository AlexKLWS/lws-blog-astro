import { secrets, skipTurnstile } from './config.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token. Returns true if the challenge passed.
 *
 * A network failure here is treated as a failure, not a pass: if Turnstile is
 * unreachable the safe outcome is to hand out no keys rather than all of them.
 */
export const verifyTurnstile = async (token, remoteIp) => {
  if (skipTurnstile) {
    console.warn('Turnstile verification skipped (SKIP_TURNSTILE=1)')
    return true
  }

  if (!token) return false

  const form = new URLSearchParams({
    secret: secrets.turnstileSecretKey,
    response: token,
  })
  if (remoteIp) form.set('remoteip', remoteIp)

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10000),
    })
    const result = await response.json()
    if (!result.success) {
      console.warn('Turnstile rejected token', result['error-codes'])
    }
    return result.success === true
  } catch (error) {
    console.error('Turnstile verification request failed', error)
    return false
  }
}
