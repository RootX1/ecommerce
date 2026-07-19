// Maps a WooCommerce REST API product into this app's Product shape.
// Video/poster URLs come from custom meta fields (added in wp-admin via
// Custom Fields or ACF) since WooCommerce has no native video field:
//   video_url        -> full R2 URL of the product's vertical video
//   video_poster_url -> optional; falls back to the product's main image
import type { Product, Review } from '../data/mockProducts';
import type { WooProduct } from './woocommerce';

/** Any category matching this is treated as "needs a design upload" on the product page. */
function isPersonalisedCategory(name: string, slug: string): boolean {
  return slug === 'personalised' || name.toLowerCase().includes('personalis');
}

function metaValue(product: WooProduct, key: string): string {
  const entry = product.meta_data?.find((m) => m.key === key);
  return typeof entry?.value === 'string' ? entry.value : '';
}

/** Strips HTML and truncates WooCommerce's short_description for the feed overlay. */
function plainShortDescription(html: string, maxLength = 140): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function mapWooProduct(product: WooProduct): Product {
  const regularPrice = Number(product.regular_price || product.price || 0);
  const price = Number(product.price || regularPrice);
  const discountPercent = regularPrice > price && regularPrice > 0 ? Math.round(((regularPrice - price) / regularPrice) * 100) : 0;

  return {
    id: String(product.id),
    slug: product.slug,
    title: product.name,
    price,
    regularPrice,
    currency: 'ZAR',
    discountPercent,
    rating: Number(product.average_rating || 0),
    reviewCount: Number(product.rating_count || 0),
    videoUrl: metaValue(product, 'video_url'),
    posterUrl: metaValue(product, 'video_poster_url') || product.images?.[0]?.src || '',
    category: product.categories?.[0]?.name ?? 'Shop',
    shortDescription: product.short_description ? plainShortDescription(product.short_description) : '',
    reviews: [] as Review[],
    requiresUpload: product.categories?.some((c) => isPersonalisedCategory(c.name, c.slug)) ?? false,
  };
}

export function mapWooProducts(products: WooProduct[]): Product[] {
  return products.map(mapWooProduct);
}
