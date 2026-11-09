import { describe, expect, it } from 'vitest';
import { getProducts } from '../src/data/signlinkData';
import { COST_LABEL } from '../src/lib/costLabel';
import { buildPartsCsv } from '../src/lib/csv';
import { calculateCosts } from '../src/lib/pricing';

const expected = {
  Smart: { count: 95, subtotal: 7830, total: 9396 },
  Connect: { count: 106, subtotal: 52710, total: 63252 },
  Vision: { count: 94, subtotal: 14869, total: 17842.8 },
} as const;

describe('product pricing data', () => {
  it.each(getProducts())('$key has the reference component count and totals', (product) => {
    const result = calculateCosts(product);
    const reference = expected[product.key];
    const partsSubtotal = product.parts.reduce(
      (sum, part) => sum + Math.round((part.price ?? 0) * 100),
      0,
    ) / 100;
    const bucketsSubtotal = product.buckets.reduce(
      (sum, bucket) => sum + Math.round(bucket.total * 100),
      0,
    ) / 100;

    expect(product.parts).toHaveLength(reference.count);
    expect(partsSubtotal).toBe(reference.subtotal);
    expect(partsSubtotal).toBe(result.subtotal);
    expect(bucketsSubtotal).toBe(result.subtotal);
    expect(result.subtotal).toBe(reference.subtotal);
    expect(result.total).toBe(reference.total);
    expect(product.parts.filter((part) => part.bucketIndex === -1 && part.price === null))
      .toHaveLength(4);
  });

  it.each(getProducts())('$key CSV includes the shared prototype build cost label', (product) => {
    const csv = buildPartsCsv(product);

    expect(csv).toContain(`"${COST_LABEL}"`);
    expect(csv).toContain(`"${COST_LABEL}","${calculateCosts(product).total.toFixed(2)}"`);
    expect(csv.match(/,"Q","Quote"(?=\r?\n|$)/g)).toHaveLength(4);
  });
});
