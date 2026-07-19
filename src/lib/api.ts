// Browser-side fetch wrappers. These call our own /api/* Cloudflare
// Pages Functions — never WooCommerce directly — so secrets stay server-side.
// Requests are prefixed with the storefront's base path since the site is
// served at yourdomain.co.za/store/ rather than a subdomain (see base.ts).
import { withBase } from './base';

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
}

export async function fetchProducts(params: { category?: string; search?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  const res = await fetch(`${withBase('/api/products')}?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load products');
  return res.json();
}

export async function fetchReviews(productId: number) {
  const res = await fetch(`${withBase('/api/reviews')}?product=${productId}`);
  if (!res.ok) throw new Error('Failed to load reviews');
  return res.json();
}

export interface SubmitReviewInput {
  productId: number;
  rating: number;
  text: string;
  name: string;
  email: string;
  recaptchaToken: string;
  website?: string;
  isFirstTimeReviewer?: boolean;
}

export async function submitReview(input: SubmitReviewInput) {
  const res = await fetch(withBase('/api/reviews'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Submission failed' }));
    throw new Error(err.error ?? 'Submission failed');
  }
  return res.json();
}

export interface CheckoutBilling {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  postcode: string;
}

export async function startCheckout(items: CartItem[], billing: CheckoutBilling) {
  const res = await fetch(withBase('/api/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        name: i.name,
      })),
      billing,
    }),
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Checkout failed' }));
    throw new Error(err.error ?? 'Checkout failed');
  }
  return res.json() as Promise<{ orderId: number; payfastHost: string; fields: Record<string, string> }>;
}

/** Submits the PayFast fields via a real HTML form POST (required by PayFast, not fetch/XHR). */
export function redirectToPayfast(payfastHost: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payfastHost;
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
