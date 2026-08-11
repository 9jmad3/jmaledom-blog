CREATE TABLE IF NOT EXISTS content_items (
	id bigserial PRIMARY KEY,
	section text NOT NULL CHECK (section IN ('recetas', 'entrenos', 'estilo')),
	slug text NOT NULL,
	title text NOT NULL,
	description text NOT NULL,
	body_markdown text NOT NULL,
	body_html text NOT NULL,
	tags text[] NOT NULL DEFAULT '{}',
	details jsonb NOT NULL DEFAULT '{}',
	image_path text,
	status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
	published_at date NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (section, slug)
);

CREATE INDEX IF NOT EXISTS content_items_section_published_idx
	ON content_items (section, published_at DESC)
	WHERE status = 'published';
