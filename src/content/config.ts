import { z, defineCollection } from 'astro:content'

const postsCollection = defineCollection({
  type: 'content',
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
