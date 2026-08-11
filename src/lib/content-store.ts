import { requireDatabase } from './db';

export type ContentSection = 'recetas' | 'entrenos' | 'estilo';
const hiddenContent = new Set(['recetas/prueba-del-nuevo-panel']);

export interface StoredContent {
	id: number;
	section: ContentSection;
	slug: string;
	title: string;
	description: string;
	bodyMarkdown: string;
	bodyHtml: string;
	tags: string[];
	details: Record<string, unknown>;
	imagePath?: string;
	publishedAt: Date;
}

interface ContentRow {
	id: string | number;
	section: ContentSection;
	slug: string;
	title: string;
	description: string;
	body_markdown: string;
	body_html: string;
	tags: string[];
	details: Record<string, unknown>;
	image_path: string | null;
	published_at: Date | string;
}

const mapRow = (row: ContentRow): StoredContent => ({
	id: Number(row.id), section: row.section, slug: row.slug, title: row.title, description: row.description,
	bodyMarkdown: row.body_markdown, bodyHtml: row.body_html, tags: row.tags, details: row.details,
	imagePath: row.image_path ? `/uploads/${row.image_path}` : undefined,
	publishedAt: new Date(row.published_at),
});

export async function listStoredContent(section: ContentSection) {
	if (!process.env.DATABASE_URL) return [];
	const result = await requireDatabase().query<ContentRow>(`
		SELECT id, section, slug, title, description, body_markdown, body_html, tags, details, image_path, published_at
		FROM content_items WHERE section = $1 AND status = 'published'
		ORDER BY published_at DESC, created_at DESC
	`, [section]);
	return result.rows.map(mapRow).filter((item) => !hiddenContent.has(`${item.section}/${item.slug}`));
}

export async function getStoredContent(section: ContentSection, slug: string) {
	if (hiddenContent.has(`${section}/${slug}`)) return null;
	if (!process.env.DATABASE_URL) return null;
	const result = await requireDatabase().query<ContentRow>(`
		SELECT id, section, slug, title, description, body_markdown, body_html, tags, details, image_path, published_at
		FROM content_items WHERE section = $1 AND slug = $2 AND status = 'published' LIMIT 1
	`, [section, slug]);
	return result.rows[0] ? mapRow(result.rows[0]) : null;
}
