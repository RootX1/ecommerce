// Shared input-sanitization and anti-spam helpers used by every
// Cloudflare Pages Function that accepts user input (reviews, checkout,
// contact form). Keeping this in one module means every endpoint gets
// the same hardening instead of ad-hoc checks per route.
import type { KVNamespace } from '@cloudflare/workers-types';

const SCRIPT_OR_LINK = /<script|javascript:|https?:\/\/|www\./i;
const HTML_TAG = /<[^>]*>/g;

export function stripHtml(input: string): string {
  return input.replace(HTML_TAG, '');
}

/** Removes tags and collapses whitespace; does NOT reject the input. */
export function sanitizeText(input: string, maxLength = 2000): string {
  return stripHtml(input).trim().slice(0, maxLength);
}

/** True if the text contains a URL or inline script — used to block link/script spam in reviews. */
export function containsLinkOrScript(input: string): boolean {
  return SCRIPT_OR_LINK.test(input);
}

/** Honeypot field: real users never fill in a field hidden via CSS, bots often do. */
export function honeypotTripped(formValue: unknown): boolean {
  return typeof formValue === 'string' && formValue.trim().length > 0;
}

export async function verifyRecaptcha(token: string, secret: string, minScore = 0.5): Promise<boolean> {
  if (!token || !secret) return false;
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success: boolean; score?: number };
  return data.success && (data.score ?? 0) >= minScore;
}

/**
 * Fixed-window rate limiter backed by a Cloudflare KV namespace.
 * Returns true if the caller is still within the allowed rate.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= limit) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}
