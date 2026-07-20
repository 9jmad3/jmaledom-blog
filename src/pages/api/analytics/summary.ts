import type { APIRoute } from 'astro';
import { getViewer, isAdmin, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

async function getCloudflareHistory() {
	const token = process.env.CLOUDFLARE_API_TOKEN;
	const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;
	const siteTag = process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
	if (!token || !accountTag || !siteTag) return { available: false, error: 'Cloudflare no está configurado.' };
	const end = new Date();
	const start = new Date(end);
	start.setUTCMonth(start.getUTCMonth() - 6);
	const query = `query History($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
		viewer { accounts(filter: { accountTag: $accountTag }) {
			total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) { count sum { visits } }
			topPaths: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 30, orderBy: [count_DESC]) { count sum { visits } dimensions { requestPath } }
		} }
	}`;
	try {
		const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables: { accountTag, filter: { AND: [{ datetime_geq: start.toISOString(), datetime_leq: end.toISOString() }, { siteTag }] } } }),
			signal: AbortSignal.timeout(10_000),
		});
		const payload = await response.json() as { data?: { viewer?: { accounts?: { total?: { count: number; sum: { visits: number } }[]; topPaths?: { count: number; sum: { visits: number }; dimensions: { requestPath: string } }[] }[] } }; errors?: { message: string }[] };
		if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? `Cloudflare respondió ${response.status}`);
		const account = payload.data?.viewer?.accounts?.[0];
		const total = account?.total?.[0];
		return {
			available: true,
			from: start.toISOString(),
			to: end.toISOString(),
			pageViews: total?.count ?? 0,
			visits: total?.sum.visits ?? 0,
			topArticles: (account?.topPaths ?? []).filter((row) => /^\/blog\/[^/]+\/$/.test(row.dimensions.requestPath)).slice(0, 10).map((row) => ({ path: row.dimensions.requestPath, pageViews: row.count, visits: row.sum.visits })),
		};
	} catch (error) {
		console.error('No se pudo consultar Cloudflare Web Analytics:', error);
		return {
			available: false,
			error: 'No se ha podido consultar el histórico de Cloudflare.',
			detail: process.env.SITE_ENVIRONMENT === 'staging' && error instanceof Error ? error.message : undefined,
		};
	}
}

export const GET: APIRoute = async ({ request }) => {
	const viewer = await getViewer(request);
	if (!viewer || !isAdmin(viewer.email)) return json({ error: 'No autorizado.' }, 403);
	const db = requireDatabase();
	const [summary, daily, articles, cloudflare] = await Promise.all([
		db.query(`SELECT
			count(*)::int AS "totalViews",
			count(*) FILTER (WHERE viewed_at >= now() - interval '30 days')::int AS "views30Days",
			count(DISTINCT visitor_hash) FILTER (WHERE viewed_at >= now() - interval '30 days')::int AS "readers30Days",
			count(*) FILTER (WHERE viewed_at >= current_date)::int AS "viewsToday",
			coalesce(round(avg(engaged_seconds) FILTER (WHERE viewed_at >= now() - interval '30 days')), 0)::int AS "averageSeconds",
			coalesce(round(100.0 * count(*) FILTER (WHERE completed AND viewed_at >= now() - interval '30 days') / nullif(count(*) FILTER (WHERE viewed_at >= now() - interval '30 days'), 0)), 0)::int AS "completionRate"
		 FROM article_readings`),
		db.query(`SELECT to_char(day, 'YYYY-MM-DD') AS date, coalesce(count(r.session_id), 0)::int AS views
		 FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') day
		 LEFT JOIN article_readings r ON r.viewed_at >= day AND r.viewed_at < day + interval '1 day'
		 GROUP BY day ORDER BY day`),
		db.query(`SELECT r.article_slug AS "articleSlug", count(*)::int AS views,
			count(DISTINCT r.visitor_hash)::int AS readers,
			coalesce(round(avg(r.engaged_seconds)), 0)::int AS "averageSeconds",
			coalesce(round(100.0 * count(*) FILTER (WHERE r.completed) / nullif(count(*), 0)), 0)::int AS "completionRate",
			(SELECT count(*)::int FROM comments c WHERE c.article_slug = r.article_slug AND c.status = 'published' AND c.deleted_at IS NULL) AS comments,
			(SELECT count(*)::int FROM article_reactions a WHERE a.article_slug = r.article_slug) AS reactions
		 FROM article_readings r WHERE r.viewed_at >= now() - interval '30 days'
		 GROUP BY r.article_slug ORDER BY views DESC`),
		getCloudflareHistory(),
	]);
	return json({ summary: summary.rows[0], daily: daily.rows, articles: articles.rows, cloudflare });
};
