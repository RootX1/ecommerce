// GET /api/auth/me — returns the signed-in identity for the current session
// cookie, or 401 if there isn't a valid one. Used by the UI to check real
// server-side session state rather than trusting anything cached client-side.
import type { APIRoute } from 'astro';
import { getSession, parseCookie, SESSION_COOKIE_NAME } from '../../../lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
  const session = await getSession(env.RATE_LIMIT_KV, token);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  }
  return new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
