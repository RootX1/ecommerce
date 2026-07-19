// Server-side WooCommerce REST API client. Only ever imported from
// server-rendered API routes (src/pages/api/*.ts), never from browser
// code — the consumer key/secret must not reach the client.

export interface WooCommerceEnv {
  PUBLIC_WOOCOMMERCE_API_URL: string;
  WOOCOMMERCE_CONSUMER_KEY: string;
  WOOCOMMERCE_CONSUMER_SECRET: string;
}

async function wooFetch<T>(env: WooCommerceEnv, path: string, init: RequestInit = {}): Promise<T> {
  // Query-string auth instead of a Basic Auth header: shared hosts (Xneelo
  // included) commonly strip the Authorization header before PHP ever sees
  // it, which breaks Basic Auth silently with a 401. Query params can't be
  // stripped that way, and WooCommerce accepts either over HTTPS.
  const url = new URL(`${env.PUBLIC_WOOCOMMERCE_API_URL}${path}`);
  url.searchParams.set('consumer_key', env.WOOCOMMERCE_CONSUMER_KEY);
  url.searchParams.set('consumer_secret', env.WOOCOMMERCE_CONSUMER_SECRET);

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
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
  short_description: string;
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
  status: string;
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: Record<string, string>;
  shipping: Record<string, string>;
  line_items: { product_id: number; quantity: number; meta_data?: { key: string; value: string }[] }[];
  shipping_lines?: { method_id: string; method_title: string; total: string }[];
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

export interface WooOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  billing: { email: string };
  line_items: { name: string; quantity: number }[];
}

/** Looks up orders placed under a given billing email — used for the account "Orders" tab. */
export function getOrdersByEmail(env: WooCommerceEnv, email: string) {
  const params = new URLSearchParams({ search: email, per_page: '50' });
  return wooFetch<WooOrder[]>(env, `/orders?${params.toString()}`).then((orders) =>
    orders.filter((o) => o.billing?.email?.toLowerCase() === email.toLowerCase())
  );
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

interface ShippingZone {
  id: number;
  name: string;
  order: number;
}

interface ShippingZoneMethod {
  method_id: string;
  method_title: string;
  enabled: boolean;
  settings: Record<string, { value: string }>;
}

export interface ShippingCost {
  cost: number;
  methodId: string;
  methodTitle: string;
}

/**
 * Reads delivery cost from WooCommerce → Settings → Shipping (Shipping
 * Zones), rather than hardcoding a number here, so the store owner can
 * change delivery pricing in wp-admin with no redeploy. Simplified: picks
 * the first enabled flat-rate/free-shipping method across zones in
 * priority order, since this storefront doesn't do per-address zone
 * matching. Falls back to R0 delivery if no shipping is configured yet.
 */
export async function getDefaultShippingCost(env: WooCommerceEnv): Promise<ShippingCost> {
  try {
    const zones = await wooFetch<ShippingZone[]>(env, '/shipping/zones');
    const ordered = [...zones.filter((z) => z.id !== 0)].sort((a, b) => a.order - b.order);
    const zoneZero = zones.find((z) => z.id === 0);
    if (zoneZero) ordered.push(zoneZero);

    for (const zone of ordered) {
      const methods = await wooFetch<ShippingZoneMethod[]>(env, `/shipping/zones/${zone.id}/methods`);
      const flatRate = methods.find((m) => m.enabled && m.method_id === 'flat_rate');
      if (flatRate) {
        return { cost: Number(flatRate.settings?.cost?.value ?? '0'), methodId: 'flat_rate', methodTitle: flatRate.method_title || 'Delivery' };
      }
      const freeShipping = methods.find((m) => m.enabled && m.method_id === 'free_shipping');
      if (freeShipping) {
        return { cost: 0, methodId: 'free_shipping', methodTitle: freeShipping.method_title || 'Free Shipping' };
      }
    }
  } catch {
    // No shipping zones configured yet, or the endpoint errored — treat as free delivery rather than blocking checkout.
  }
  return { cost: 0, methodId: 'flat_rate', methodTitle: 'Delivery' };
}
