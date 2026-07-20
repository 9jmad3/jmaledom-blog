import type { APIRoute } from 'astro';
import { getViewer, isAdmin, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const viewer = await getViewer(request);
	if (!viewer || !isAdmin(viewer.email)) return json({ error: 'No autorizado.' }, 403);
	const db = requireDatabase();
	const [summary, daily, articles] = await Promise.all([
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
	]);
	return json({ summary: summary.rows[0], daily: daily.rows, articles: articles.rows });
};
