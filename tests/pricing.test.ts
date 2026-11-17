import { describe, expect, it } from 'vitest';
import { getProducts } from '../src/data/signlinkData';
import { COST_LABEL } from '../src/lib/costLabel';
import { buildPartsCsv } from '../src/lib/csv';
import { formatWholePeso } from '../src/lib/format';
import {
  calculateCosts,
  calculateEstimatedMarketPrice,
  MARKET_PRICING_DATA,
} from '../src/lib/pricing';

const expected = {
  Smart: { count: 95, subtotal: 7830, total: 9396 },
  Connect: { count: 106, subtotal: 52710, total: 63252 },
  Vision: { count: 94, subtotal: 14869, total: 17842.8 },
} as const;

const expectedMarketPricing = {
  Smart: { modeledPartsCost: 14914.24, allowance: 0.35, marketPrice: 20134 },
  Connect: { modeledPartsCost: 74052.24, allowance: 0.45, marketPrice: 107376 },
  Vision: { modeledPartsCost: 15562.32, allowance: 0.4, marketPrice: 21787 },
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

  it.each(Object.keys(expectedMarketPricing) as Array<keyof typeof expectedMarketPricing>)(
    '%s uses its own modeled cost and pricing allowance',
    (key) => {
      const expectedPricing = expectedMarketPricing[key];
      const actual = calculateEstimatedMarketPrice(key);

      expect(MARKET_PRICING_DATA[key].modeledPartsCost).toBe(expectedPricing.modeledPartsCost);
      expect(MARKET_PRICING_DATA[key].pricingAllowance).toBe(expectedPricing.allowance);
      expect(actual.calculatedPrice).toBeCloseTo(
        expectedPricing.modeledPartsCost * (1 + expectedPricing.allowance),
        8,
      );
      expect(actual.estimatedMarketPrice).toBe(expectedPricing.marketPrice);
      expect(formatWholePeso(actual.estimatedMarketPrice)).toBe(
        `₱${expectedPricing.marketPrice.toLocaleString('en-PH')}`,
      );
    },
  );

  it.each(getProducts())('$key CSV includes the shared prototype build cost label', (product) => {
    const csv = buildPartsCsv(product);
    const marketPrice = calculateEstimatedMarketPrice(product.key);

    expect(csv).toContain('"Estimated Market Price"');
    expect(csv).toContain(`"Estimated Market Price","${marketPrice.estimatedMarketPrice}"`);
    expect(csv).toContain(`"Total Cost of Modeled Parts","${marketPrice.modeledPartsCost.toFixed(2)}"`);
    expect(csv).toContain(`"Estimated Pricing Allowance","${Math.round(marketPrice.pricingAllowance * 100)}%"`);
    expect(csv).toContain(`"${COST_LABEL}"`);
    expect(csv).toContain(`"${COST_LABEL}","${calculateCosts(product).total.toFixed(2)}"`);
    expect(csv.match(/,"Q","Quote"(?=\r?\n|$)/g)).toHaveLength(4);
  });
});
