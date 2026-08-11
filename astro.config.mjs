// @ts-check

import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE_URL ?? 'https://www.jmaledom.es',
	adapter: node({ mode: 'standalone' }),
	// State-changing API routes validate their public origin explicitly. Railway's proxy
	// otherwise makes Astro reject legitimate multipart uploads before they reach the route.
	security: { checkOrigin: false },
	integrations: [mdx(), sitemap({ filter: (page) =>
		!page.endsWith('/comentarios/') &&
		!page.includes('/admin/') &&
		!page.includes('/entrenos') &&
		!page.includes('/estilo')
	})],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
