// GET  /api/reviews?product=123        -> approved reviews for a product
// POST /api/reviews                     -> submit a new review (spam-protected)
import type { APIRoute } from 'astro';
import { listProductReviews, createProductReview } from '../../lib/woocommerce';
import { sanitizeText, containsLinkOrScript, honeypotTripped, verifyTurnstile, checkRateLimit, clientIp } from '../../lib/security';
import { getSession, parseCookie, SESSION_COOKIE_NAME } from '../../lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const productId = url.searchParams.get('product');
  if (!productId) {
    return new Response(JSON.stringify({ error: 'Missing product id' }), { status: 400 });
  }
  const reviews = await listProductReviews(env, productId);
  return new Response(JSON.stringify(reviews), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  });
};

interface ReviewPayload {
  productId: number;
  rating: number;
  text: string;
  turnstileToken: string;
  website?: string; // honeypot — must stay empty
  isFirstTimeReviewer?: boolean;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  // 1. Rate limit: 5 review submissions per IP per 10 minutes.
  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `review:${ip}`, 5, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many submissions, please try again later.' }), {
      status: 429,
    });
  }

  // 2. Identity comes ONLY from the session cookie — never from anything
  // the client claims in the request body. This is what stops someone
  // from posting a review "as" another customer just by knowing their
  // email address.
  const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
  const session = await getSession(env.RATE_LIMIT_KV, token);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Please sign in to write a review.' }), { status: 401 });
  }

  let payload: ReviewPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  // 3. Honeypot — bots fill in hidden fields, real users never see them.
  if (honeypotTripped(payload.website)) {
    return new Response(JSON.stringify({ error: 'Submission rejected' }), { status: 400 });
  }

  // 4. Cloudflare Turnstile.
  const human = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!human) {
    return new Response(JSON.stringify({ error: 'Verification failed, please try again.' }), { status: 400 });
  }

  const rating = Math.min(5, Math.max(1, Math.round(Number(payload.rating))));
  const text = sanitizeText(payload.text, 2000);

  // 5. Block links/scripts in review text outright.
  if (containsLinkOrScript(text)) {
    return new Response(JSON.stringify({ error: 'Links are not allowed in reviews.' }), { status: 400 });
  }

  if (!text || !payload.productId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  // 6. First-time reviewers go to the moderation queue regardless of score.
  const status = payload.isFirstTimeReviewer ? 'hold' : 'approved';

  const review = await createProductReview(env, {
    product_id: payload.productId,
    review: text,
    reviewer: session.name || session.email,
    reviewer_email: session.email,
    rating,
    status,
  });

  return new Response(JSON.stringify(review), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
