export const BLOG_TAGS = {
	relaciones: 'Relaciones',
	baile: 'Baile',
	percepcion: 'Percepción',
	vulnerabilidad: 'Vulnerabilidad',
	identidad: 'Identidad',
} as const;

export const BLOG_TAG_SLUGS = Object.keys(BLOG_TAGS) as [BlogTag, ...BlogTag[]];

export type BlogTag = keyof typeof BLOG_TAGS;

export function getTagLabel(tag: BlogTag) {
	return BLOG_TAGS[tag];
}

export function getTagUrl(tag: BlogTag) {
	return `/blog/etiqueta/${tag}/`;
}
