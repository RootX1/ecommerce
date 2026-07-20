// Real session tokens — not just a "this email logged in once" flag.
// A successful login/signup gets a random, unguessable token stored
// server-side (token -> {email, name}) and handed to the browser as an
// HttpOnly cookie. Every gated endpoint resolves identity FROM THAT COOKIE,
// never from anything the client claims in a request body — so knowing a
// customer's email address is never enough to read their orders or post
// a review as them.
import type { KVNamespace } from '@cloudflare/workers-types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const SESSION_COOKIE_NAME = 'session';

interface SessionData {
  email: string;
  name: string;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(kv: KVNamespace, email: string, name: string): Promise<string> {
  const token = randomToken();
  await kv.put(`session:${token}`, JSON.stringify({ email: email.toLowerCase(), name } satisfies SessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function getSession(kv: KVNamespace, token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;
  const raw = await kv.get(`session:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function deleteSession(kv: KVNamespace, token: string | undefined): Promise<void> {
  if (!token) return;
  await kv.delete(`session:${token}`);
}

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/store; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/store; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
