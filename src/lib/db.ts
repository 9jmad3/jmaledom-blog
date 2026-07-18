import { Pool } from 'pg';

const globalForDb = globalThis as typeof globalThis & { jmaledomPool?: Pool };

export const db =
	globalForDb.jmaledomPool ??
	new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 5,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 5_000,
	});

if (import.meta.env.DEV) globalForDb.jmaledomPool = db;

export function requireDatabase() {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada');
	return db;
}
