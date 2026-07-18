import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const baseURL = site ?? new URL('https://www.jmaledom.es');
	const sitemapURL = new URL('sitemap-index.xml', baseURL);
	const isStaging = import.meta.env.SITE_ENVIRONMENT === 'staging';
	const rules = isStaging
		? 'User-agent: *\nDisallow: /\n'
		: `User-agent: *\nAllow: /\nSitemap: ${sitemapURL}\n`;

	return new Response(rules, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
