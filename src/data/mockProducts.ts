// Placeholder catalog used until the real WooCommerce backend is connected.
// Shape mirrors the subset of the WooCommerce REST API "product" schema
// that the UI actually consumes, so swapping in live data is a drop-in.

export interface Review {
  id: string;
  author: string;
  rating: number; // 1-5
  text: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  price: number;
  regularPrice: number;
  currency: string;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  videoUrl: string;
  posterUrl: string;
  category: string;
  shortDescription?: string;
  description?: string;
  reviews: Review[];
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
    rating: 4.8,
    reviewCount: 132,
    videoUrl: '/videos/sample-1.mp4',
    posterUrl: '/videos/sample-1-poster.jpg',
    category: 'Canvas Prints',
    shortDescription: 'Museum-quality canvas print from your own photo, stretched on a solid wood frame.',
    reviews: [
      {
        id: 'r1',
        author: 'Thandiwe M.',
        rating: 5,
        text: 'Print quality is incredible, colours popped exactly like the preview.',
        verifiedPurchase: true,
        createdAt: '2026-06-02',
      },
      {
        id: 'r2',
        author: 'Riaan V.',
        rating: 4,
        text: 'Fast delivery to Cape Town, canvas frame is sturdy.',
        verifiedPurchase: true,
        createdAt: '2026-05-20',
      },
    ],
  },
  {
    id: 'prod_2',
    slug: 'photo-mug-personalised',
    title: 'Personalised Photo Mug',
    price: 149,
    regularPrice: 149,
    currency: 'ZAR',
    discountPercent: 0,
    rating: 4.6,
    reviewCount: 87,
    videoUrl: '/videos/sample-2.mp4',
    posterUrl: '/videos/sample-2-poster.jpg',
    category: 'Photo Gifts',
    reviews: [],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return mockProducts.find((p) => p.slug === slug);
}
