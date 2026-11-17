import type { Product } from '../data/signlinkData';
import { COST_LABEL } from './costLabel';
import { formatWholePeso } from './format';
import {
  calculateCosts,
  calculateEstimatedMarketPrice,
  MARKET_PRICE_DISCLAIMER,
  MARKET_PRICE_MISSING_COMPONENTS_NOTE,
  MARKET_PRICE_SOURCE,
} from './pricing';

export function buildPartsCsv(product: Product): string {
  const costs = calculateCosts(product);
  const marketPrice = calculateEstimatedMarketPrice(product.key);
  const rows: Array<Array<string | number>> = [
    ['Pricing estimate', 'Amount', 'Basis'],
    [
      'Total Cost of Modeled Parts',
      marketPrice.modeledPartsCost.toFixed(2),
      MARKET_PRICE_SOURCE,
    ],
    [
      'Estimated Pricing Allowance',
      `${Math.round(marketPrice.pricingAllowance * 100)}%`,
      'Product-specific estimated allowance',
    ],
    [
      'Estimated Market Price',
      marketPrice.estimatedMarketPrice.toFixed(0),
      formatWholePeso(marketPrice.estimatedMarketPrice),
    ],
    ['Pricing disclaimer', MARKET_PRICE_DISCLAIMER],
    ['Pricing note', MARKET_PRICE_MISSING_COMPONENTS_NOTE],
    [],
    ['ID', 'Part', 'Category', 'Price basis', 'Price type', 'Price PHP'],
    ...product.parts.map((part) => {
      const bucket = part.bucketIndex < 0 ? null : product.buckets[part.bucketIndex];
      return [
        part.id,
        part.name,
        part.category,
        bucket?.label ?? 'No catalog price',
        part.priceType,
        part.price === null ? 'Quote' : part.price.toFixed(2),
      ];
    }),
    ['', '', '', '', 'Subtotal', costs.subtotal.toFixed(2)],
    ['', '', '', '', 'Contingency 20%', costs.contingency.toFixed(2)],
    ['', '', '', '', COST_LABEL, costs.total.toFixed(2)],
  ];
  return rows
    .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}
