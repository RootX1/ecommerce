// Server-side WooCommerce REST API client. Only ever imported from
// server-rendered API routes (src/pages/api/*.ts), never from browser
// code — the consumer key/secret must not reach the client.

export interface WooCommerceEnv {
  PUBLIC_WOOCOMMERCE_API_URL: string;
  WOOCOMMERCE_CONSUMER_KEY: string;
  WOOCOMMERCE_CONSUMER_SECRET: string;
}

function authHeader(env: WooCommerceEnv): string {
  const token = btoa(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`);
  return `Basic ${token}`;
}

async function wooFetch<T>(env: WooCommerceEnv, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${env.PUBLIC_WOOCOMMERCE_API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(env),
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WooCommerce API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  price: string;
  regular_price: string;
  average_rating: string;
  rating_count: number;
  images: { src: string }[];
  categories: { id: number; name: string; slug: string }[];
  meta_data: { key: string; value: unknown }[];
}

export function listProducts(env: WooCommerceEnv, params: URLSearchParams = new URLSearchParams()) {
  return wooFetch<WooProduct[]>(env, `/products?${params.toString()}`);
}

export function getProduct(env: WooCommerceEnv, id: string | number) {
  return wooFetch<WooProduct>(env, `/products/${id}`);
}

export async function getProductBySlug(env: WooCommerceEnv, slug: string): Promise<WooProduct | undefined> {
  const products = await wooFetch<WooProduct[]>(env, `/products?slug=${encodeURIComponent(slug)}`);
  return products[0];
}

export interface WooProductCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export function listProductCategories(env: WooCommerceEnv) {
  const params = new URLSearchParams({ per_page: '100', hide_empty: 'true' });
  return wooFetch<WooProductCategory[]>(env, `/products/categories?${params.toString()}`);
}

export function listProductReviews(env: WooCommerceEnv, productId: string | number) {
  return wooFetch(env, `/products/reviews?product=${productId}&status=approved`);
}

export interface NewReviewInput {
  product_id: number;
  review: string;
  reviewer: string;
  reviewer_email: string;
  rating: number;
  status: 'hold' | 'approved';
}

export function createProductReview(env: WooCommerceEnv, input: NewReviewInput) {
  return wooFetch(env, '/products/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface NewOrderInput {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: Record<string, string>;
  line_items: { product_id: number; quantity: number; meta_data?: { key: string; value: string }[] }[];
}

export function createOrder(env: WooCommerceEnv, input: NewOrderInput) {
  return wooFetch(env, '/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOrderStatus(env: WooCommerceEnv, orderId: string | number, status: string) {
  return wooFetch(env, `/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function getOrder(env: WooCommerceEnv, orderId: string | number) {
  return wooFetch(env, `/orders/${orderId}`);
}

export interface BacsAccountDetail {
  account_name: string;
  account_number: string;
  bank_name: string;
  sort_code: string;
  iban: string;
  bic: string;
}

export interface BacsGateway {
  enabled: string;
  settings: {
    account_details?: { value: BacsAccountDetail[] };
    instructions?: { value: string };
  };
}

/** Reads the "Direct bank transfer" gateway's live settings (account details are managed in WP admin, not hardcoded here). */
export function getBacsGateway(env: WooCommerceEnv) {
  return wooFetch<BacsGateway>(env, '/payment_gateways/bacs');
}
