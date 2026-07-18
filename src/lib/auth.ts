import { betterAuth } from 'better-auth';
import { db } from './db';

export const auth = betterAuth({
	appName: 'jmaledom',
	baseURL: process.env.BETTER_AUTH_URL ?? process.env.SITE_URL ?? 'http://localhost:4321',
	secret: process.env.BETTER_AUTH_SECRET ?? 'development-only-secret-change-before-production',
	database: db,
	account: {
		encryptOAuthTokens: true,
	},
	advanced: {
		database: { generateId: 'uuid' },
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? 'google-client-id-not-configured',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'google-client-secret-not-configured',
			prompt: 'select_account',
		},
	},
	trustedOrigins: [process.env.BETTER_AUTH_URL ?? process.env.SITE_URL ?? 'http://localhost:4321'],
});
