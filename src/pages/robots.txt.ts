import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const baseURL = site ?? new URL('https://www.jmaledom.es');
	const sitemapURL = new URL('sitemap-index.xml', baseURL);

	return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemapURL}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
