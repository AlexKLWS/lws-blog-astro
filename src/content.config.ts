import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const postsCollection = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    pubDate: z.date(),
    metaDescription: z.string().optional(),
    icon: z.string().optional(),
    tags: z.array(z.string()),
    private: z.boolean(),
  }),
})

export const collections = {
  posts: postsCollection,
}
