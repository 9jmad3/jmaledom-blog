CREATE TABLE IF NOT EXISTS article_reactions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	article_slug text NOT NULL,
	visitor_hash char(64) NOT NULL,
	reaction varchar(16) NOT NULL CHECK (reaction IN ('like', 'think', 'relate')),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (article_slug, visitor_hash)
);

CREATE INDEX IF NOT EXISTS article_reactions_totals_idx
	ON article_reactions (article_slug, reaction);
