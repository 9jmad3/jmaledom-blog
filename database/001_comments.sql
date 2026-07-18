CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS comments (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	article_slug text NOT NULL,
	user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
	author_name varchar(60) NOT NULL,
	author_image text,
	body varchar(1500) NOT NULL,
	status varchar(16) NOT NULL DEFAULT 'published'
		CHECK (status IN ('published', 'pending', 'rejected')),
	moderation_reason text,
	ip_hash char(64) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS comments_article_published_idx
	ON comments (article_slug, created_at)
	WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS comments_rate_limit_idx ON comments (ip_hash, created_at DESC);
