import type { APIRoute } from 'astro';
import { createHmac } from 'node:crypto';
import { getClientIp, isTrustedRequest, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	if (!isTrustedRequest(context.request)) return json({ error: 'Origen no permitido.' }, 403);
	const userAgent = context.request.headers.get('user-agent') ?? '';
	if (/bot|crawler|spider|headless|preview/i.test(userAgent)) return json({ recorded: false });
	const raw = await context.request.text();
	const input = (() => { try { return JSON.parse(raw); } catch { return null; } })() as { sessionId?: string; article?: string; engagedSeconds?: number; maxScroll?: number; completed?: boolean } | null;
	if (!input?.sessionId || !/^[0-9a-f-]{36}$/i.test(input.sessionId)) return json({ error: 'Sesión no válida.' }, 400);
	if (!input.article || !/^[a-z0-9-]{1,120}$/.test(input.article)) return json({ error: 'Artículo no válido.' }, 400);
	const engagedSeconds = Math.max(0, Math.min(3600, Math.round(Number(input.engagedSeconds) || 0)));
	const maxScroll = Math.max(0, Math.min(100, Math.round(Number(input.maxScroll) || 0)));
	const secret = process.env.ANALYTICS_HASH_SECRET ?? process.env.COMMENT_IP_SECRET ?? process.env.BETTER_AUTH_SECRET;
	if (!secret) return json({ error: 'Analítica no configurada.' }, 503);
	const visitorHash = createHmac('sha256', secret).update(`${getClientIp(context)}|${userAgent}`).digest('hex');
	await requireDatabase().query(
		`INSERT INTO article_readings (session_id, article_slug, visitor_hash, engaged_seconds, max_scroll, completed)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (session_id) DO UPDATE SET
			last_seen_at = now(),
			engaged_seconds = GREATEST(article_readings.engaged_seconds, EXCLUDED.engaged_seconds),
			max_scroll = GREATEST(article_readings.max_scroll, EXCLUDED.max_scroll),
			completed = article_readings.completed OR EXCLUDED.completed`,
		[input.sessionId, input.article, visitorHash, engagedSeconds, maxScroll, Boolean(input.completed)],
	);
	return json({ recorded: true });
};
