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

/** Fetches full product records for a set of saved ids (e.g. the wishlist). */
export async function fetchProductsByIds(ids: (string | number)[]) {
  if (ids.length === 0) return [];
  const res = await fetch(`${withBase('/api/products')}?include=${ids.join(',')}`);
  if (!res.ok) throw new Error('Failed to load products');
  return res.json();
}

export interface AuthResult {
  email: string;
  name: string;
}

/** Signs in with a real WooCommerce account (email + password). */
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(withBase('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Sign in failed' }));
    throw new Error(err.error ?? 'Sign in failed');
  }
  return res.json();
}

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Creates a new WooCommerce account and signs in immediately. */
export async function signupUser(input: SignupInput): Promise<AuthResult> {
  const res = await fetch(withBase('/api/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Sign up failed' }));
    throw new Error(err.error ?? 'Sign up failed');
  }
  return res.json();
}

/** Clears the current session (server-side and the cookie). */
export async function logoutUser(): Promise<void> {
  await fetch(withBase('/api/auth/logout'), { method: 'POST' });
}

/** Checks whether the browser currently holds a valid, server-verified session. */
export async function fetchCurrentUser(): Promise<AuthResult | null> {
  const res = await fetch(withBase('/api/auth/me'));
  if (!res.ok) return null;
  return res.json();
}

export interface OrderSummary {
  id: number;
  status: string;
  date_created: string;
  total: string;
  line_items: { name: string; quantity: number }[];
}

/** Looks up orders for the currently signed-in account (identity comes from the session cookie). */
export async function fetchMyOrders(): Promise<OrderSummary[]> {
  const res = await fetch(withBase('/api/orders'));
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({ error: 'Unable to load orders' }));
    throw new Error(err.error ?? 'Unable to load orders');
  }
  return res.json();
}

export interface SubmitReviewInput {
  productId: number;
  rating: number;
  text: string;
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
  items: { name: string; quantity: number; unitPrice: number }[];
  itemsTotal: number;
  shippingCost: number;
  shippingTitle: string;
  total: number;
  paymentMethodTitle: string;
  billingEmail: string;
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
