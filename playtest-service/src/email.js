import { secrets } from './config.js'

const RESEND_URL = 'https://api.resend.com/emails'

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const activationSteps = (gameName) => [
  'Open the Steam client and log in.',
  'In the top menu, click <strong>Games</strong> → <strong>Activate a Product on Steam…</strong>',
  'Accept the subscriber agreement, choose <strong>Product Code</strong>, and paste in the key from this email.',
  `${gameName} will appear in your library, ready to install.`,
]

const feedbackSentence = "You ticked the box saying you'd fill out a form once you finish the game — thank you, that genuinely matters for a solo project."

const buildHtml = ({ campaign, name, keyCode, willFillForm }) => {
  const steps = activationSteps(escapeHtml(campaign.gameName))
    .map((step) => `<li style="margin-bottom:8px;">${step}</li>`)
    .join('')

  const feedbackBlock = !willFillForm
    ? ''
    : campaign.feedbackFormUrl
      ? `<p style="margin:24px 0 0;">${feedbackSentence} Here it is, whenever you get there:<br />
         <a href="${escapeHtml(campaign.feedbackFormUrl)}">${escapeHtml(campaign.feedbackFormUrl)}</a></p>`
      : `<p style="margin:24px 0 0;">${feedbackSentence} I'll email you the form separately.</p>`

  const steamBlock = campaign.steamAppUrl
    ? `<p style="margin:0 0 16px;">The Steam page, if you want to wishlist or follow along:<br />
        <a href="${escapeHtml(campaign.steamAppUrl)}">${escapeHtml(campaign.steamAppUrl)}</a></p>`
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#ffffff;color:#000000;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;line-height:1.6;">
    <div style="max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;font-weight:700;margin:0 0 24px;">${escapeHtml(campaign.gameName)} — playtest key</h1>

      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>

      <p style="margin:0 0 16px;">Thanks for signing up to playtest <strong>${escapeHtml(campaign.gameName)}</strong>. Here's your Steam key:</p>

      <p style="margin:0 0 24px;padding:16px;background:#f4f4f4;border:1px solid #d8d8d8;font-size:18px;font-weight:600;letter-spacing:1px;text-align:center;">${escapeHtml(keyCode)}</p>

      <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;">How to redeem it</h2>
      <ol style="margin:0 0 16px;padding-left:20px;">${steps}</ol>

      <p style="margin:0 0 24px;">You can also redeem it in a browser at
        <a href="https://store.steampowered.com/account/registerkey">store.steampowered.com/account/registerkey</a>.</p>

      ${steamBlock}
      ${feedbackBlock}

      <p style="margin:24px 0 0;">If anything breaks, crashes, or just feels off, reply straight to this email — bug reports from playtesters are the most useful thing I get.</p>

      <p style="margin:24px 0 0;">— ${escapeHtml(campaign.signOff)}<br />
        <span style="color:#646464;">${escapeHtml(campaign.developer)}</span></p>

      <p style="margin:32px 0 0;font-size:12px;color:#646464;">This key is yours alone — please don't share or resell it. You're receiving this because you requested a key at ${escapeHtml(campaign.siteName)}.</p>
    </div>
  </body>
</html>`
}

const buildText = ({ campaign, name, keyCode, willFillForm }) => {
  const steps = activationSteps(campaign.gameName)
    .map((step, index) => `  ${index + 1}. ${step.replace(/<\/?strong>/g, '')}`)
    .join('\n')

  const feedbackBlock = !willFillForm
    ? ''
    : campaign.feedbackFormUrl
      ? `\n${feedbackSentence} Here it is:\n${campaign.feedbackFormUrl}\n`
      : `\n${feedbackSentence} I'll email you the form separately.\n`

  const steamBlock = campaign.steamAppUrl
    ? `\nThe Steam page, if you want to wishlist or follow along:\n${campaign.steamAppUrl}\n`
    : ''

  return `${campaign.gameName} - playtest key

Hi ${name},

Thanks for signing up to playtest ${campaign.gameName}. Here's your Steam key:

    ${keyCode}

How to redeem it:
${steps}

You can also redeem it in a browser at:
https://store.steampowered.com/account/registerkey
${steamBlock}${feedbackBlock}
If anything breaks, crashes, or just feels off, reply straight to this email -
bug reports from playtesters are the most useful thing I get.

- ${campaign.signOff}
${campaign.developer}

This key is yours alone - please don't share or resell it. You're receiving this
because you requested a key at ${campaign.siteName}.
`
}

/**
 * Sends the key email via Resend. Throws on any non-2xx so the caller can mark
 * the signup as undelivered and retry later.
 */
export const sendKeyEmail = async ({ campaign, to, name, keyCode, willFillForm }) => {
  const payload = {
    from: campaign.fromEmail,
    to: [to],
    reply_to: campaign.replyTo,
    subject: campaign.emailSubject || `Your ${campaign.gameName} playtest key`,
    html: buildHtml({ campaign, name, keyCode, willFillForm }),
    text: buildText({ campaign, name, keyCode, willFillForm }),
  }

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secrets.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`)
  }

  return response.json()
}
