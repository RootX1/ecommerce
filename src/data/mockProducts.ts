// Placeholder catalog used until the real WooCommerce backend is connected.
// Shape mirrors the subset of the WooCommerce REST API "product" schema
// that the UI actually consumes, so swapping in live data is a drop-in.

export interface Product {
  id: string;
  slug: string;
  title: string;
  price: number;
  regularPrice: number;
  currency: string;
  discountPercent: number;
  videoUrl: string;
  posterUrl: string;
  category: string;
  shortDescription?: string;
  description?: string;
  /** True when this product is in the "Personalised" WooCommerce category — shows the design-upload field. */
  requiresUpload?: boolean;
}

export const mockProducts: Product[] = [
  {
    id: 'prod_1',
    slug: 'canvas-print-a2',
    title: 'Custom A2 Canvas Print',
    price: 449,
    regularPrice: 599,
    currency: 'ZAR',
    discountPercent: 25,
    videoUrl: '/videos/sample-1.mp4',
    posterUrl: '/videos/sample-1-poster.jpg',
    category: 'Canvas Prints',
    shortDescription: 'Museum-quality canvas print from your own photo, stretched on a solid wood frame.',
  },
  {
    id: 'prod_2',
    slug: 'photo-mug-personalised',
    title: 'Personalised Photo Mug',
    price: 149,
    regularPrice: 149,
    currency: 'ZAR',
    discountPercent: 0,
    videoUrl: '/videos/sample-2.mp4',
    posterUrl: '/videos/sample-2-poster.jpg',
    category: 'Photo Gifts',
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return mockProducts.find((p) => p.slug === slug);
}
