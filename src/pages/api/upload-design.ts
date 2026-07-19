// POST /api/upload-design
// Uploads a customer's design image (for personalised products like mugs)
// to Cloudflare R2 and returns its public URL, which the frontend attaches
// to the cart item and later to the WooCommerce order line item.
import type { APIRoute } from 'astro';
import { checkRateLimit, clientIp } from '../../lib/security';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `upload:${ip}`, 10, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many uploads, please try again shortly.' }), { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid upload' }), { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(JSON.stringify({ error: 'Only JPG, PNG, WEBP, or GIF images are allowed.' }), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Image is too large (max 8MB).' }), { status: 400 });
  }

  const key = `designs/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  await env.UPLOADS_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return new Response(JSON.stringify({ url: `${env.PUBLIC_UPLOADS_BASE_URL}/${key}` }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
