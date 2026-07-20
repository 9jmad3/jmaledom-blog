import type { APIRoute } from 'astro';
import { getViewer, isAdmin, isTrustedRequest, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

async function authorize(request: Request) {
	const viewer = await getViewer(request);
	return viewer && isAdmin(viewer.email) ? viewer : null;
}

export const GET: APIRoute = async ({ request }) => {
	if (!(await authorize(request))) return json({ error: 'No autorizado.' }, 403);
	const result = await requireDatabase().query(
		`SELECT id, article_slug AS "articleSlug", author_name AS "authorName", body,
		        status, moderation_reason AS "moderationReason", created_at AS "createdAt"
		 FROM comments
		 WHERE status IN ('pending', 'published', 'rejected') AND deleted_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT 500`,
	);
	return json({ comments: result.rows });
};

export const PATCH: APIRoute = async ({ request }) => {
	if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
	if (!(await authorize(request))) return json({ error: 'No autorizado.' }, 403);
	const input = (await request.json().catch(() => null)) as { id?: string; action?: string } | null;
	if (!input?.id || !/^[0-9a-f-]{36}$/i.test(input.id)) return json({ error: 'Comentario no válido.' }, 400);
	if (input.action !== 'publish' && input.action !== 'reject') return json({ error: 'Acción no válida.' }, 400);
	const status = input.action === 'publish' ? 'published' : 'rejected';
	const result = await requireDatabase().query(
		`UPDATE comments SET status = $2, moderation_reason = NULL WHERE id = $1 AND status = 'pending' RETURNING id`,
		[input.id, status],
	);
	if (!result.rowCount) return json({ error: 'El comentario ya no está pendiente.' }, 404);
	return json({ updated: true });
};
