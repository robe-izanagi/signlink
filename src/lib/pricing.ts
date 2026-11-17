import type { Product } from '../data/signlinkData';
import type { ProductKey } from '../data/signlinkData';

export const CONTINGENCY_RATE = 0.2;
export const MARKET_PRICE_SOURCE =
  'SIGNLINK Resource & Price Catalog — Updated November 17, 2026.';
export const MARKET_PRICE_DISCLAIMER =
  'Estimated product prices are calculated using the modeled component costs from the SIGNLINK Resource & Price Catalog, plus a product-specific estimated pricing allowance. These are preliminary planning estimates because software requirements, additional development hardware, tooling, and other implementation requirements have not yet been finalized. Actual production costs and final selling prices may change.';
export const MARKET_PRICE_MISSING_COMPONENTS_NOTE =
  'The CONNECT optical module and other missing or quote-required electronics may affect the final price.';

export interface EstimatedMarketPrice {
  modeledPartsCost: number;
  pricingAllowance: number;
  calculatedPrice: number;
  estimatedMarketPrice: number;
}

export const MARKET_PRICING_DATA: Readonly<Record<
  ProductKey,
  Pick<EstimatedMarketPrice, 'modeledPartsCost' | 'pricingAllowance'>
>> = {
  Smart: { modeledPartsCost: 14914.24, pricingAllowance: 0.35 },
  Connect: { modeledPartsCost: 74052.24, pricingAllowance: 0.45 },
  Vision: { modeledPartsCost: 15562.32, pricingAllowance: 0.4 },
};

export interface ProductCosts {
  subtotal: number;
  contingency: number;
  total: number;
}

export function calculateEstimatedMarketPrice(key: ProductKey): EstimatedMarketPrice {
  const { modeledPartsCost, pricingAllowance } = MARKET_PRICING_DATA[key];
  const calculatedPrice = modeledPartsCost * (1 + pricingAllowance);

  return {
    modeledPartsCost,
    pricingAllowance,
    calculatedPrice,
    estimatedMarketPrice: Math.round(calculatedPrice),
  };
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
