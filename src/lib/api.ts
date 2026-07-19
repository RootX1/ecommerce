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
  /** R2 URL of the customer's uploaded design, for personalised products. */
  designImageUrl?: string;
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
  turnstileToken: string;
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

/** Uploads a customer's design file for a personalised product; returns its public R2 URL. */
export async function uploadDesign(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(withBase('/api/upload-design'), {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error ?? 'Upload failed');
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

export interface BacsAccountDetail {
  account_name: string;
  account_number: string;
  bank_name: string;
  sort_code: string;
  iban: string;
  bic: string;
}

export interface CheckoutResult {
  orderId: number;
  itemsTotal: number;
  shippingCost: number;
  shippingTitle: string;
  total: number;
  instructions: string;
  accountDetails: BacsAccountDetail[];
}

export interface ShippingInfo {
  cost: number;
  methodTitle: string;
}

/** Fetches the store's current delivery cost so it can be shown before checkout is submitted. */
export async function fetchShippingCost(): Promise<ShippingInfo> {
  const res = await fetch(withBase('/api/shipping'));
  if (!res.ok) return { cost: 0, methodTitle: 'Delivery' };
  return res.json();
}

export async function startCheckout(items: CartItem[], billing: CheckoutBilling): Promise<CheckoutResult> {
  const res = await fetch(withBase('/api/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        name: i.name,
        designImageUrl: i.designImageUrl,
      })),
      billing,
    }),
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Checkout failed' }));
    throw new Error(err.error ?? 'Checkout failed');
  }
  return res.json();
}
