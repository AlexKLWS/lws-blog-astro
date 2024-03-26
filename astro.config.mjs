import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  redirects: {
    '/tags/[tag]': '/tags/[tag]/1',
  },
  redirects: {
    '/tags': '/tags/[tag]/1',
  },
  markdown: {
    shikiConfig: {
      theme: 'night-owl',
    },
  },
})
