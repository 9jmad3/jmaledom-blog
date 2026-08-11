import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const filename = params.path ?? '';
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.webp$/.test(filename)) return new Response('No encontrado', { status: 404 });
	const root = resolve(process.env.UPLOADS_DIR ?? (process.env.NODE_ENV === 'production' ? '/app/uploads' : './.data/uploads'));
	const path = resolve(root, filename);
	if (!path.startsWith(`${root}${sep}`)) return new Response('No encontrado', { status: 404 });
	try {
		const file = await readFile(path);
		return new Response(file, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } });
	} catch {
		return new Response('No encontrado', { status: 404 });
	}
};
