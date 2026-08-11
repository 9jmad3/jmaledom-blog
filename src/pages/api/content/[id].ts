import type { APIRoute } from 'astro';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getViewer, isAdmin, isTrustedRequest, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;
const uploadsDirectory = () => resolve(process.env.UPLOADS_DIR ?? (process.env.NODE_ENV === 'production' ? '/app/uploads' : './.data/uploads'));

export const DELETE: APIRoute = async ({ request, params }) => {
	if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
	const viewer = await getViewer(request);
	if (!viewer || !isAdmin(viewer.email)) return json({ error: 'No autorizado.' }, 403);
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Contenido no válido.' }, 400);
	const result = await requireDatabase().query('DELETE FROM content_items WHERE id=$1 RETURNING image_path', [id]);
	if (!result.rowCount) return json({ error: 'El contenido ya no existe.' }, 404);
	const imagePath = result.rows[0].image_path as string | null;
	if (imagePath) await unlink(resolve(uploadsDirectory(), imagePath)).catch(() => undefined);
	return json({ deleted: true });
};
