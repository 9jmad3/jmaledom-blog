import type { APIRoute } from 'astro';
import { getViewer, isAdmin, json } from '../../../lib/comments';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const viewer = await getViewer(request);
	return json({ isAdmin: isAdmin(viewer?.email) });
};
