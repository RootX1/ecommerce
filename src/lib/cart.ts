// Client-side cart persisted to localStorage. Synced to WooCommerce only
// at checkout time via /api/checkout — there's no server cart session,
// which keeps the storefront fully static/edge-cacheable.
import type { CartItem } from './api';

const STORAGE_KEY = 'tiktok-shop-cart';

function read(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
}

export function getCart(): CartItem[] {
  return read();
}

export function addToCart(item: CartItem) {
  const items = read();
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    items.push(item);
  }
  write(items);
}

export function updateQuantity(productId: number, quantity: number) {
  const items = read();
  const item = items.find((i) => i.productId === productId);
  if (!item) return;
  if (quantity <= 0) {
    write(items.filter((i) => i.productId !== productId));
  } else {
    item.quantity = quantity;
    write(items);
  }
}

export function removeFromCart(productId: number) {
  write(read().filter((i) => i.productId !== productId));
}

export function clearCart() {
  write([]);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
