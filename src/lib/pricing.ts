import type { Product } from '../data/signlinkData';

export const CONTINGENCY_RATE = 0.2;

export interface ProductCosts {
  subtotal: number;
  contingency: number;
  total: number;
}

export function calculateCosts(product: Product): ProductCosts {
  const subtotalCents = product.buckets.reduce(
    (sum, bucket) => sum + Math.round(bucket.total * 100),
    0,
  );
  const subtotal = subtotalCents / 100;
  const contingency = Math.round(subtotalCents * CONTINGENCY_RATE) / 100;

  return {
    subtotal,
    contingency,
    total: subtotal + contingency,
  };
}
