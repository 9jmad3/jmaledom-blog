import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { BLOG_TAG_SLUGS } from './lib/tags';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			socialImage: z.optional(image()),
			tags: z.array(z.enum(BLOG_TAG_SLUGS)).min(1).max(3),
		}),
});

const recetas = defineCollection({
	loader: glob({ base: './src/content/recetas', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(), description: z.string(), pubDate: z.coerce.date(), heroImage: image().optional(),
		time: z.number().int().positive(), servings: z.number().int().positive(), difficulty: z.enum(['Fácil', 'Media', 'Elaborada']),
		calories: z.number().int().positive().optional(), protein: z.number().nonnegative().optional(), tags: z.array(z.string()).min(1).max(5),
	}),
});

const entrenos = defineCollection({
	loader: glob({ base: './src/content/entrenos', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(), description: z.string(), pubDate: z.coerce.date(), heroImage: image().optional(),
		duration: z.number().int().positive(), level: z.enum(['Inicial', 'Intermedio', 'Avanzado']), goal: z.string(),
		equipment: z.array(z.string()).min(1), tags: z.array(z.string()).min(1).max(5),
	}),
});

const estilo = defineCollection({
	loader: glob({ base: './src/content/estilo', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) => z.object({
		title: z.string(), description: z.string(), pubDate: z.coerce.date(), heroImage: image().optional(),
		occasion: z.string(), season: z.string(), palette: z.array(z.string()).min(1).max(5), pieces: z.array(z.string()).min(1), tags: z.array(z.string()).min(1).max(5),
	}),
});

export const collections = { blog, recetas, entrenos, estilo };
