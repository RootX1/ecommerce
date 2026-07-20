// POST /api/auth/logout — invalidates the session server-side and clears the cookie.
import type { APIRoute } from 'astro';
import { deleteSession, clearSessionCookieHeader, parseCookie, SESSION_COOKIE_NAME } from '../../../lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
  await deleteSession(env.RATE_LIMIT_KV, token);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookieHeader() },
  });
};
