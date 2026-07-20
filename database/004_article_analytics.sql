CREATE TABLE IF NOT EXISTS article_readings (
	session_id uuid PRIMARY KEY,
	article_slug text NOT NULL,
	visitor_hash char(64) NOT NULL,
	viewed_at timestamptz NOT NULL DEFAULT now(),
	last_seen_at timestamptz NOT NULL DEFAULT now(),
	engaged_seconds integer NOT NULL DEFAULT 0 CHECK (engaged_seconds BETWEEN 0 AND 3600),
	max_scroll smallint NOT NULL DEFAULT 0 CHECK (max_scroll BETWEEN 0 AND 100),
	completed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS article_readings_date_idx ON article_readings (viewed_at DESC);
CREATE INDEX IF NOT EXISTS article_readings_article_date_idx ON article_readings (article_slug, viewed_at DESC);
CREATE INDEX IF NOT EXISTS article_readings_visitor_idx ON article_readings (visitor_hash, viewed_at DESC);
