// @ts-check
import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'

// https://astro.build/config
export default defineConfig({
  // Required for absolute og:url / og:image URLs — Layout.astro reads this via
  // import.meta.env.SITE. Without it, link previews break everywhere.
  site: 'https://blog.longwintershadows.com',
  // Astro 7 swapped the Markdown processor to Sätteri, whose SmartyPants gets
  // some closing quotes backwards (rendering “ where ” belongs). Staying on the
  // unified/remark pipeline keeps existing posts rendering exactly as before.
  markdown: {
    processor: unified(),
  },
  integrations: [mdx()],
})
