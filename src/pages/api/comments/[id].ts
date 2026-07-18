import type { APIRoute } from 'astro';
import { getViewer, isAdmin, isTrustedRequest, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
	if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
	const viewer = await getViewer(request);
	if (!viewer) return json({ error: 'Inicia sesión para eliminar el comentario.' }, 401);
	const id = params.id ?? '';
	if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Comentario no válido.' }, 400);

	try {
		const result = await requireDatabase().query(
			`UPDATE comments SET deleted_at = now(), body = '[Comentario eliminado]'
			 WHERE id = $1 AND deleted_at IS NULL AND (user_id = $2 OR $3 = true)
			 RETURNING id`,
			[id, viewer.id, isAdmin(viewer.email)],
		);
		if (!result.rowCount) return json({ error: 'No puedes eliminar este comentario.' }, 403);
		return json({ deleted: true });
	} catch (error) {
		console.error('Error al eliminar comentario:', error);
		const detail = process.env.SITE_ENVIRONMENT === 'staging' && error instanceof Error ? error.message : undefined;
		return json({ error: 'No se ha podido eliminar.', detail }, 500);
	}
};
