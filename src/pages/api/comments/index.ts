import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { COMMENT_MAX_LENGTH, getClientIp, getViewer, hashIp, isAdmin, isTrustedRequest, json, moderateComment, verifyTurnstile } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function articleExists(slug: string) {
	return (await getCollection('blog')).some((post) => post.id === slug);
}

export const GET: APIRoute = async ({ url, request }) => {
	const article = url.searchParams.get('article')?.trim() ?? '';
	if (!slugPattern.test(article)) return json({ error: 'Artículo no válido.' }, 400);
	if (!(await articleExists(article))) return json({ error: 'El artículo no existe.' }, 404);
	const viewer = await getViewer(request);

	const result = await requireDatabase().query(
		`SELECT id, author_name AS "authorName", author_image AS "authorImage", body,
		        created_at AS "createdAt", user_id IS NOT NULL AS "registered",
		        (user_id = $2 OR $3 = true) AS "canDelete"
		 FROM comments
		 WHERE article_slug = $1 AND status = 'published' AND deleted_at IS NULL
		 ORDER BY created_at ASC`,
		[article, viewer?.id ?? null, isAdmin(viewer?.email)],
	);
	return json({ comments: result.rows, viewer: viewer ? { name: viewer.name, image: viewer.image } : null });
};

export const POST: APIRoute = async (context) => {
	if (!isTrustedRequest(context.request)) return json({ error: 'Origen no permitido.' }, 403);
	let input: Record<string, unknown>;
	try {
		input = await context.request.json();
	} catch {
		return json({ error: 'Petición no válida.' }, 400);
	}

	const article = String(input.article ?? '').trim();
	const body = String(input.body ?? '').trim();
	const honeypot = String(input.website ?? '').trim();
	const turnstileToken = String(input.turnstileToken ?? '');
	if (honeypot) return json({ error: 'No se ha podido publicar el comentario.' }, 400);
	if (!slugPattern.test(article)) return json({ error: 'Artículo no válido.' }, 400);
	if (!(await articleExists(article))) return json({ error: 'El artículo no existe.' }, 404);
	if (body.length < 2 || body.length > COMMENT_MAX_LENGTH) {
		return json({ error: `El comentario debe tener entre 2 y ${COMMENT_MAX_LENGTH} caracteres.` }, 400);
	}

	const viewer = await getViewer(context.request);
	const authorName = String(input.name ?? '').trim();
	const showAvatar = input.showAvatar === true;
	if (authorName.length < 2 || authorName.length > 60) return json({ error: 'Indica un nombre válido.' }, 400);

	const ip = getClientIp(context);
	if (!(await verifyTurnstile(turnstileToken, ip))) return json({ error: 'No hemos podido verificar que seas una persona.' }, 400);

	const ipHash = hashIp(ip);
	const db = requireDatabase();
	const recent = await db.query(
		`SELECT count(*)::int AS count FROM comments
		 WHERE ip_hash = $1 AND created_at > now() - interval '10 minutes'`,
		[ipHash],
	);
	const rateLimit = process.env.SITE_ENVIRONMENT === 'staging' ? 50 : viewer ? 10 : 5;
	if (!isAdmin(viewer?.email) && recent.rows[0].count >= rateLimit) {
		return json({ error: 'Has enviado varios comentarios. Espera unos minutos.' }, 429);
	}

	const moderation = moderateComment(body);
	if (moderation.status === 'rejected') return json({ error: 'El comentario parece spam y no se ha publicado.' }, 400);

	const inserted = await db.query(
		`INSERT INTO comments
		 (article_slug, user_id, author_name, author_image, body, status, moderation_reason, ip_hash)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, author_name AS "authorName", author_image AS "authorImage", body,
		           created_at AS "createdAt", status`,
		[article, viewer?.id ?? null, authorName, viewer && showAvatar ? viewer.image ?? null : null, body, moderation.status, moderation.reason, ipHash],
	);

	return json({ comment: inserted.rows[0], pending: moderation.status === 'pending' }, 201);
};
