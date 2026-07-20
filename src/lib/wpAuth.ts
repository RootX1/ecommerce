// Thin client for the "JWT Authentication for WP REST API" WordPress
// plugin — used only to confirm a visitor knows their real WooCommerce
// account password. We don't keep or forward the returned JWT anywhere:
// once login succeeds, the Worker issues its own session token
// (src/lib/session.ts), which is what actually gates reviews/order lookups.
export interface WpAuthEnv {
  PUBLIC_WORDPRESS_API_URL: string;
}

export interface JwtLoginResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

function wpSiteRoot(env: WpAuthEnv): string {
  return env.PUBLIC_WORDPRESS_API_URL.replace(/\/wp-json\/wp\/v2\/?$/, '');
}

/** Strips HTML from a WordPress error message (they're often wrapped in <strong>/<p> tags). */
function plainErrorMessage(message: unknown, fallback: string): string {
  if (typeof message !== 'string' || !message) return fallback;
  return message.replace(/<[^>]*>/g, '').trim() || fallback;
}

export async function loginWithPassword(env: WpAuthEnv, username: string, password: string): Promise<JwtLoginResponse> {
  const res = await fetch(`${wpSiteRoot(env)}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body: { message?: string } = await res.json().catch(() => ({}));
    throw new Error(plainErrorMessage(body.message, 'Incorrect email or password.'));
  }
  return res.json();
}
