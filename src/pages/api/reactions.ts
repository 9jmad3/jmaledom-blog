import { createHmac } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getViewer, isTrustedRequest, json } from '../../lib/comments';
import { requireDatabase } from '../../lib/db';

export const prerender = false;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reactions = ['like', 'think', 'relate'] as const;
type Reaction = typeof reactions[number];

async function articleExists(slug: string) {
	return (await getCollection('blog')).some((post) => post.id === slug);
}

function visitorHash(value: string) {
	const secret = process.env.COMMENT_IP_SECRET ?? process.env.BETTER_AUTH_SECRET;
	if (!secret && import.meta.env.PROD) throw new Error('COMMENT_IP_SECRET no está configurada');
	return createHmac('sha256', secret ?? 'local-development').update(value).digest('hex');
}

async function getIdentity(request: Request, visitorId: string) {
	const viewer = await getViewer(request);
	if (viewer) return visitorHash(`user:${viewer.id}`);
	if (!visitorPattern.test(visitorId)) return null;
	return visitorHash(`guest:${visitorId}`);
}

export const GET: APIRoute = async ({ url, request }) => {
	const article = url.searchParams.get('article')?.trim() ?? '';
	const visitorId = url.searchParams.get('visitor')?.trim() ?? '';
	if (!slugPattern.test(article) || !(await articleExists(article))) return json({ error: 'Artículo no válido.' }, 400);

	const identity = await getIdentity(request, visitorId);
	const result = await requireDatabase().query(
		`SELECT reaction, count(*)::int AS count,
		        COALESCE(bool_or(visitor_hash = $2), false) AS selected
		 FROM article_reactions
		 WHERE article_slug = $1
		 GROUP BY reaction`,
		[article, identity ?? ''],
	);
	const totals: Record<Reaction, number> = { like: 0, think: 0, relate: 0 };
	let selected: Reaction | null = null;
	for (const row of result.rows as Array<{ reaction: Reaction; count: number; selected: boolean }>) {
		totals[row.reaction] = row.count;
		if (row.selected) selected = row.reaction;
	}
	return json({ totals, selected });
};

export const POST: APIRoute = async ({ request }) => {
	if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
	const input = await request.json().catch(() => null) as { article?: string; reaction?: string | null; visitorId?: string } | null;
	const article = input?.article?.trim() ?? '';
	const reaction = input?.reaction ?? null;
	const visitorId = input?.visitorId?.trim() ?? '';
	if (!slugPattern.test(article) || !(await articleExists(article))) return json({ error: 'Artículo no válido.' }, 400);
	if (reaction !== null && !reactions.includes(reaction as Reaction)) return json({ error: 'Reacción no válida.' }, 400);
	const identity = await getIdentity(request, visitorId);
	if (!identity) return json({ error: 'No se ha podido guardar la reacción.' }, 400);

	const db = requireDatabase();
	if (reaction === null) {
		await db.query('DELETE FROM article_reactions WHERE article_slug = $1 AND visitor_hash = $2', [article, identity]);
	} else {
		await db.query(
			`INSERT INTO article_reactions (article_slug, visitor_hash, reaction)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (article_slug, visitor_hash)
			 DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()`,
			[article, identity, reaction],
		);
	}
	return json({ updated: true });
};
