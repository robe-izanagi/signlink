import type { Product } from '../data/signlinkData';
import { COST_LABEL } from './costLabel';
import { calculateCosts } from './pricing';

export function buildPartsCsv(product: Product): string {
  const costs = calculateCosts(product);
  const rows: Array<Array<string | number>> = [
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
