/**
 * Minimal flag parsing shared by the ops scripts.
 *   node script.js --campaign=distant-light-prologue file.txt
 *   node script.js --campaign distant-light-prologue file.txt
 */
export const parseArgs = (argv) => {
  const flags = {}
  const positional = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const body = arg.slice(2)
    if (body.includes('=')) {
      const [key, ...rest] = body.split('=')
      flags[key] = rest.join('=')
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      flags[body] = argv[i + 1]
      i += 1
    } else {
      flags[body] = true
    }
  }

  return { flags, positional }
}

export const requireCampaign = (flags) => {
  const campaign = flags.campaign
  if (typeof campaign !== 'string' || !campaign) {
    console.error('Missing --campaign <id>. Run `npm run campaigns` to list them.')
    process.exit(1)
  }
  return campaign
}
