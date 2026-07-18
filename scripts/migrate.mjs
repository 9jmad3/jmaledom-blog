import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('DATABASE_URL no está configurada.');
	process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(root, 'database');
const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
	await client.query(`
		CREATE TABLE IF NOT EXISTS app_migrations (
			name text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`);

	for (const file of files) {
		const exists = await client.query('SELECT 1 FROM app_migrations WHERE name = $1', [file]);
		if (exists.rowCount) continue;

		const sql = await readFile(join(migrationsDirectory, file), 'utf8');
		await client.query('BEGIN');
		try {
			await client.query(sql);
			await client.query('INSERT INTO app_migrations (name) VALUES ($1)', [file]);
			await client.query('COMMIT');
			console.log(`Migración aplicada: ${file}`);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		}
	}
} finally {
	client.release();
	await pool.end();
}
