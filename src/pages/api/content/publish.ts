import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getViewer, isAdmin, isTrustedRequest, json } from '../../../lib/comments';

export const prerender = false;

type Section = 'recetas' | 'entrenos' | 'estilo';
const sectionLabels: Record<Section, string> = { recetas: 'receta', entrenos: 'entreno', estilo: 'conjunto' };
const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const yaml = (value: string) => JSON.stringify(value);
const number = (data: FormData, name: string, optional = false) => {
	const raw = text(data, name);
	if (!raw && optional) return undefined;
	const value = Number(raw);
	return Number.isFinite(value) && (optional ? value >= 0 : value > 0) ? value : null;
};

async function requireAdmin(request: Request) {
	const viewer = await getViewer(request);
	return Boolean(viewer && isAdmin(viewer.email));
}

export const GET: APIRoute = async ({ request }) => {
	if (!(await requireAdmin(request))) return json({ error: 'No autorizado.' }, 403);
	return json({
		configured: Boolean(process.env.GITHUB_CONTENT_TOKEN),
		branch: process.env.GITHUB_CONTENT_BRANCH ?? 'codex/comments-system',
		repository: process.env.GITHUB_CONTENT_REPOSITORY ?? '9jmad3/jmaledom-blog',
	});
};

async function githubRequest(path: string, token: string, init?: RequestInit) {
	return fetch(`https://api.github.com/repos/${process.env.GITHUB_CONTENT_REPOSITORY ?? '9jmad3/jmaledom-blog'}/contents/${path}`, {
		...init,
		headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...init?.headers },
		signal: AbortSignal.timeout(15_000),
	});
}

async function exists(path: string, token: string, branch: string) {
	const response = await githubRequest(`${path}?ref=${encodeURIComponent(branch)}`, token);
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(`GitHub no pudo comprobar el archivo (${response.status}).`);
	return true;
}

async function createFile(path: string, content: Uint8Array | string, message: string, token: string, branch: string) {
	const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
	const response = await githubRequest(path, token, { method: 'PUT', body: JSON.stringify({ message, content: bytes.toString('base64'), branch }) });
	const result = await response.json().catch(() => null) as { content?: { html_url?: string }; message?: string } | null;
	if (!response.ok) throw new Error(result?.message ?? `GitHub rechazó el archivo (${response.status}).`);
	return result?.content?.html_url;
}

function buildFrontmatter(section: Section, data: FormData, imagePath?: string) {
	const common = [`title: ${yaml(text(data, 'title'))}`, `description: ${yaml(text(data, 'description'))}`, `pubDate: ${text(data, 'pubDate')}`];
	if (imagePath) common.push(`heroImage: ${imagePath}`);
	if (section === 'recetas') common.push(
		`time: ${number(data, 'time')}`, `servings: ${number(data, 'servings')}`, `difficulty: ${yaml(text(data, 'difficulty'))}`,
		...(number(data, 'calories', true) ? [`calories: ${number(data, 'calories', true)}`] : []),
		...(number(data, 'protein', true) ? [`protein: ${number(data, 'protein', true)}`] : []), `tags: ${JSON.stringify(list(text(data, 'tags')))}`,
	);
	if (section === 'entrenos') common.push(
		`duration: ${number(data, 'duration')}`, `level: ${yaml(text(data, 'level'))}`, `goal: ${yaml(text(data, 'goal'))}`,
		`equipment: ${JSON.stringify(list(text(data, 'equipment')))}`, `tags: ${JSON.stringify(list(text(data, 'tags')))}`,
	);
	if (section === 'estilo') common.push(
		`occasion: ${yaml(text(data, 'occasion'))}`, `season: ${yaml(text(data, 'season'))}`,
		`palette: ${JSON.stringify(list(text(data, 'palette')))}`, `pieces: ${JSON.stringify(list(text(data, 'pieces')))}`, `tags: ${JSON.stringify(list(text(data, 'tags')))}`,
	);
	return `---\n${common.join('\n')}\n---\n\n${text(data, 'body')}\n`;
}

export const POST: APIRoute = async ({ request }) => {
	try {
		if (!isTrustedRequest(request)) return json({ error: 'Origen no permitido.' }, 403);
		if (!(await requireAdmin(request))) return json({ error: 'No autorizado.' }, 403);
		const token = process.env.GITHUB_CONTENT_TOKEN;
		const branch = process.env.GITHUB_CONTENT_BRANCH ?? 'codex/comments-system';
		if (!token) return json({ error: 'Falta configurar GITHUB_CONTENT_TOKEN.' }, 503);
		const data = await request.formData();
		const section = text(data, 'section') as Section;
		const slug = text(data, 'slug');
		if (!(section in sectionLabels)) return json({ error: 'Sección no válida.' }, 400);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 90) return json({ error: 'El slug no es válido.' }, 400);
		if (text(data, 'title').length < 3 || text(data, 'title').length > 120) return json({ error: 'Revisa el título.' }, 400);
		if (text(data, 'description').length < 20 || text(data, 'description').length > 260) return json({ error: 'La descripción debe tener entre 20 y 260 caracteres.' }, 400);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(text(data, 'pubDate'))) return json({ error: 'La fecha no es válida.' }, 400);
		if (text(data, 'body').length < 40) return json({ error: 'El contenido es demasiado corto.' }, 400);
		if (!list(text(data, 'tags')).length) return json({ error: 'Añade al menos una etiqueta.' }, 400);
		if (section === 'recetas' && (!number(data, 'time') || !number(data, 'servings') || !['Fácil', 'Media', 'Elaborada'].includes(text(data, 'difficulty'))))
			return json({ error: 'Revisa el tiempo, las raciones y la dificultad.' }, 400);
		if (section === 'entrenos' && (!number(data, 'duration') || !['Inicial', 'Intermedio', 'Avanzado'].includes(text(data, 'level')) || !text(data, 'goal') || !list(text(data, 'equipment')).length))
			return json({ error: 'Revisa la duración, el nivel, el objetivo y el material.' }, 400);
		if (section === 'estilo' && (!text(data, 'occasion') || !text(data, 'season') || !list(text(data, 'palette')).length || !list(text(data, 'pieces')).length))
			return json({ error: 'Revisa la ocasión, la temporada, la paleta y las prendas.' }, 400);
		const contentPath = `src/content/${section}/${slug}.md`;
		if (await exists(contentPath, token, branch)) return json({ error: 'Ya existe contenido con ese slug.' }, 409);

		const image = data.get('image');
		let imagePath: string | undefined;
		if (image instanceof File && image.size) {
			if (image.size > 8 * 1024 * 1024) return json({ error: 'La imagen no puede superar 8 MB.' }, 400);
			if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return json({ error: 'La imagen debe ser JPG, PNG o WebP.' }, 400);
			const assetPath = `src/assets/${section}-${slug}.webp`;
			if (await exists(assetPath, token, branch)) return json({ error: 'Ya existe una imagen para ese slug.' }, 409);
			const optimized = await sharp(Buffer.from(await image.arrayBuffer())).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
			await createFile(assetPath, optimized, `Add image for ${sectionLabels[section]} ${slug}`, token, branch);
			imagePath = `../../assets/${section}-${slug}.webp`;
		}

		const markdown = buildFrontmatter(section, data, imagePath);
		const githubUrl = await createFile(contentPath, markdown, `Publish ${sectionLabels[section]} ${slug}`, token, branch);
		return json({ published: true, branch, githubUrl, previewUrl: `/${section}/${slug}/` });
	} catch (error) {
		console.error('Error al publicar contenido:', error);
		return json({ error: error instanceof Error ? error.message : 'No se ha podido publicar.' }, 500);
	}
};
