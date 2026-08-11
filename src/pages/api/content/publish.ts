import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import sharp from 'sharp';
import { getViewer, isAdmin, isTrustedRequest, json } from '../../../lib/comments';
import { requireDatabase } from '../../../lib/db';

export const prerender = false;

type Section = 'recetas' | 'entrenos' | 'estilo';
const sectionLabels: Record<Section, string> = { recetas: 'receta', entrenos: 'entreno', estilo: 'conjunto' };
const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const number = (data: FormData, name: string, optional = false) => {
	const raw = text(data, name);
	if (!raw && optional) return undefined;
	const value = Number(raw);
	return Number.isFinite(value) && (optional ? value >= 0 : value > 0) ? value : null;
};
const uploadsDirectory = () => resolve(process.env.UPLOADS_DIR ?? (process.env.NODE_ENV === 'production' ? '/app/uploads' : './.data/uploads'));

async function requireAdmin(request: Request) {
	const viewer = await getViewer(request);
	return Boolean(viewer && isAdmin(viewer.email));
}

export const GET: APIRoute = async ({ request }) => {
	if (!(await requireAdmin(request))) return json({ error: 'No autorizado.' }, 403);
	if (!process.env.DATABASE_URL) return json({ configured: false, storage: 'Railway PostgreSQL + Volume', items: [] });
	const result = await requireDatabase().query(`SELECT id, section, slug, title, description, body_markdown AS "bodyMarkdown",
		tags, details, image_path AS "imagePath", status, to_char(published_at, 'YYYY-MM-DD') AS "publishedAt",
		created_at AS "createdAt", updated_at AS "updatedAt" FROM content_items ORDER BY updated_at DESC`);
	return json({ configured: true, storage: 'Railway PostgreSQL + Volume', items: result.rows });
};

function details(section: Section, data: FormData) {
	if (section === 'recetas') return { time: number(data, 'time'), servings: number(data, 'servings'), difficulty: text(data, 'difficulty'), calories: number(data, 'calories', true), protein: number(data, 'protein', true) };
	if (section === 'entrenos') return { duration: number(data, 'duration'), level: text(data, 'level'), goal: text(data, 'goal'), equipment: list(text(data, 'equipment')) };
	return { occasion: text(data, 'occasion'), season: text(data, 'season'), palette: list(text(data, 'palette')), pieces: list(text(data, 'pieces')) };
}

export const POST: APIRoute = async ({ request }) => {
	let finalImagePath: string | undefined;
	try {
		if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
		if (!(await requireAdmin(request))) return json({ error: 'No autorizado.' }, 403);
		if (!process.env.DATABASE_URL) return json({ error: 'La base de datos no está configurada.' }, 503);
		const data = await request.formData();
		const intent = text(data, 'intent') || 'published';
		const editingId = Number(text(data, 'id')) || null;
		const section = text(data, 'section') as Section;
		const slug = text(data, 'slug');
		const title = text(data, 'title');
		const description = text(data, 'description');
		const bodyMarkdown = text(data, 'body');
		const tags = list(text(data, 'tags'));
		const publishedAt = text(data, 'pubDate');
		if (!['preview', 'draft', 'published'].includes(intent)) return json({ error: 'Acción no válida.' }, 400);
		if (!(section in sectionLabels)) return json({ error: 'Sección no válida.' }, 400);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 90) return json({ error: 'El slug no es válido.' }, 400);
		if (title.length < 3 || title.length > 120) return json({ error: 'Revisa el título.' }, 400);
		const requiresCompleteContent = intent !== 'draft';
		if (requiresCompleteContent && (description.length < 20 || description.length > 260)) return json({ error: 'La descripción debe tener entre 20 y 260 caracteres.' }, 400);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return json({ error: 'La fecha no es válida.' }, 400);
		if (requiresCompleteContent && bodyMarkdown.length < 40) return json({ error: 'El contenido es demasiado corto.' }, 400);
		if (requiresCompleteContent && (!tags.length || tags.length > 5)) return json({ error: 'Añade entre una y cinco etiquetas.' }, 400);
		if (requiresCompleteContent && section === 'recetas' && (!number(data, 'time') || !number(data, 'servings') || !['Fácil', 'Media', 'Elaborada'].includes(text(data, 'difficulty'))))
			return json({ error: 'Revisa el tiempo, las raciones y la dificultad.' }, 400);
		if (requiresCompleteContent && section === 'entrenos' && (!number(data, 'duration') || !['Inicial', 'Intermedio', 'Avanzado'].includes(text(data, 'level')) || !text(data, 'goal') || !list(text(data, 'equipment')).length))
			return json({ error: 'Revisa la duración, el nivel, el objetivo y el material.' }, 400);
		if (requiresCompleteContent && section === 'estilo' && (!text(data, 'occasion') || !text(data, 'season') || !list(text(data, 'palette')).length || !list(text(data, 'pieces')).length))
			return json({ error: 'Revisa la ocasión, la temporada, la paleta y las prendas.' }, 400);
		const database = requireDatabase();
		const duplicate = await database.query('SELECT 1 FROM content_items WHERE section = $1 AND slug = $2 AND ($3::bigint IS NULL OR id <> $3)', [section, slug, editingId]);
		const staticEntry = await getEntry(section, slug);
		if (duplicate.rowCount || staticEntry) return json({ error: 'Ya existe contenido con ese slug.' }, 409);

		const image = data.get('image');
		let imageName: string | null = null;
		if (intent !== 'preview' && image instanceof File && image.size) {
			if (image.size > 8 * 1024 * 1024) return json({ error: 'La imagen no puede superar 8 MB.' }, 400);
			if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return json({ error: 'La imagen debe ser JPG, PNG o WebP.' }, 400);
			await mkdir(uploadsDirectory(), { recursive: true });
			imageName = `${section}-${slug}-${randomUUID()}.webp`;
			finalImagePath = resolve(uploadsDirectory(), imageName);
			const temporaryPath = `${finalImagePath}.tmp`;
			const optimized = await sharp(Buffer.from(await image.arrayBuffer())).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
			await writeFile(temporaryPath, optimized);
			await rename(temporaryPath, finalImagePath);
		}

		const rawHtml = await marked.parse(bodyMarkdown || '', { async: true });
		const bodyHtml = sanitizeHtml(rawHtml, { allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, a: ['href', 'name', 'target', 'rel'] }, allowedSchemes: ['http', 'https', 'mailto'] });
		if (intent === 'preview') return json({ preview: true, title, description, section, tags, details: details(section, data), bodyHtml, imageUrl: imageName ? `/uploads/${imageName}` : text(data, 'existingImage') || null });
		if (editingId) {
			const current = await database.query('SELECT image_path FROM content_items WHERE id = $1', [editingId]);
			if (!current.rowCount) return json({ error: 'El contenido ya no existe.' }, 404);
			const previousImage = current.rows[0].image_path as string | null;
			await database.query(`UPDATE content_items SET section=$1, slug=$2, title=$3, description=$4, body_markdown=$5,
				body_html=$6, tags=$7, details=$8, image_path=COALESCE($9,image_path), published_at=$10, status=$11, updated_at=now() WHERE id=$12`,
				[section, slug, title, description, bodyMarkdown, bodyHtml, tags, details(section, data), imageName, publishedAt, intent, editingId]);
			if (imageName && previousImage) await unlink(resolve(uploadsDirectory(), previousImage)).catch(() => undefined);
		} else {
			await database.query(`INSERT INTO content_items
				(section, slug, title, description, body_markdown, body_html, tags, details, image_path, published_at, status)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
				[section, slug, title, description, bodyMarkdown, bodyHtml, tags, details(section, data), imageName, publishedAt, intent]);
		}
		return json({ saved: true, status: intent, storage: 'Railway', previewUrl: `/${section}/${slug}/` });
	} catch (error) {
		if (finalImagePath) await unlink(finalImagePath).catch(() => undefined);
		console.error('Error al publicar contenido:', error);
		return json({ error: error instanceof Error ? error.message : 'No se ha podido publicar.' }, 500);
	}
};
