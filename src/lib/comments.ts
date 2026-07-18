import { createHmac } from 'node:crypto';
import type { APIContext } from 'astro';
import { auth } from './auth';

export const COMMENT_MAX_LENGTH = 1_500;

export type CommentStatus = 'published' | 'pending' | 'rejected';

export function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}

export function isTrustedRequest(request: Request) {
	const origin = request.headers.get('origin');
	if (!origin) return false;
	const expected = new URL(process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? request.url).origin;
	return origin === expected || (import.meta.env.DEV && origin === new URL(request.url).origin);
}

export async function getViewer(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user ?? null;
}

export function getClientIp(context: APIContext) {
	return (
		context.request.headers.get('cf-connecting-ip') ??
		context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		context.clientAddress ??
		'unknown'
	);
}

export function hashIp(ip: string) {
	const secret = process.env.COMMENT_IP_SECRET ?? process.env.BETTER_AUTH_SECRET;
	if (!secret && import.meta.env.PROD) throw new Error('COMMENT_IP_SECRET no está configurada');
	return createHmac('sha256', secret ?? 'local-development').update(ip).digest('hex');
}

export function moderateComment(body: string): { status: CommentStatus; reason: string | null } {
	const normalized = body.toLocaleLowerCase('es');
	const links = body.match(/https?:\/\/|www\./gi)?.length ?? 0;
	const repeated = /(.)\1{9,}/u.test(body);
	const spam = /(casino|cryptocurrency|forex|viagra|free money|seo service|backlinks)/i.test(normalized);
	const risky = /(amenaza|matar|suicid|nazi|violaci[oó]n|pornograf)/i.test(normalized);

	if (spam || links > 4) return { status: 'rejected', reason: 'spam' };
	if (links > 1 || repeated || risky) return { status: 'pending', reason: 'automatic_review' };
	return { status: 'published', reason: null };
}

export async function verifyTurnstile(token: string, ip: string) {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return import.meta.env.DEV;
	if (!token) return false;

	const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ secret, response: token, remoteip: ip }),
		signal: AbortSignal.timeout(8_000),
	});
	if (!response.ok) return false;
	const result = (await response.json()) as { success?: boolean };
	return result.success === true;
}

export function getAdminEmails() {
	return (process.env.COMMENT_ADMIN_EMAILS ?? '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

export function isAdmin(email?: string | null) {
	return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}
