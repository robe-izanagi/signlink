import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Product, ProductKey } from '../data/signlinkData';
import { COST_LABEL } from '../lib/costLabel';
import { formatMoney } from '../lib/format';
import { calculateCosts } from '../lib/pricing';

const PRODUCT_NAMES: Record<ProductKey, string> = {
  Smart: 'SIGNLINK Smart',
  Connect: 'SIGNLINK Connect',
  Vision: 'SIGNLINK Vision',
};
const PRODUCT_USERS: Record<ProductKey, string> = {
  Smart: 'General users',
  Connect: 'Deaf and hard-of-hearing users',
  Vision: 'Blind and low-vision users',
};
const ACCENTS: Record<ProductKey, string> = {
  Smart: '#6aa8ff',
  Connect: '#2fd6c9',
  Vision: '#ffa23a',
};
const BUCKET_COLORS = [
  '#6aa8ff', '#2fd6c9', '#ffa23a', '#b58cff', '#ff6b8a', '#7bd88f',
  '#f2d16b', '#8aa0c0', '#4dd0e1', '#ef9a62', '#9ccc65', '#ba68c8',
];

interface SummaryCardsProps {
  products: readonly Product[];
  onExplore: (product: ProductKey) => void;
}

export function SummaryCards({ products, onExplore }: SummaryCardsProps) {
  return (
    <div className="summary-cards">
      {products.map((product) => {
        const costs = calculateCosts(product);
        const quotes = product.parts.filter((part) => part.price === null).length;
        return (
          <article
            className="summary-card"
            key={product.key}
            style={{ '--accent': ACCENTS[product.key] } as CSSProperties}
          >
            <h3>{PRODUCT_NAMES[product.key]}</h3>
            <small>{PRODUCT_USERS[product.key]}</small>
            <div className="summary-amount">{formatMoney(costs.total)}</div>
            <span className="summary-cost-label">{COST_LABEL}</span>
            <small>Estimated prototype cost incl. 20% contingency</small>
            <dl>
              <dt>Components modelled</dt><dd>{product.parts.length}</dd>
              <dt>Priced line items</dt><dd>{product.buckets.length}</dd>
              <dt>Subtotal</dt><dd>{formatMoney(costs.subtotal)}</dd>
              <dt>Contingency (20%)</dt><dd>{formatMoney(costs.contingency)}</dd>
              <dt>Quote-only parts</dt><dd>{quotes}</dd>
            </dl>
            <button type="button" className="button button-outline" onClick={() => onExplore(product.key)}>
              Open in 3D explorer
            </button>
          </article>
        );
      })}
    </div>
  );
}

export type SortColumn = 'id' | 'name' | 'category' | 'priceType' | 'price' | 'share';

interface PartsTableProps {
  product: Product;
  onProductChange: (key: ProductKey) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sortColumn: SortColumn;
  sortAscending: boolean;
  onSort: (column: SortColumn) => void;
  onSelect: (name: string) => void;
  onExport: () => void;
  selectedPart: string | null;
}

const sortLabels: Array<[SortColumn, string]> = [
  ['id', 'ID'],
  ['name', 'Part'],
  ['category', 'Category'],
  ['priceType', 'Price basis'],
  ['price', 'Price (PHP)'],
  ['share', 'Share'],
];

export function PartsTable({
  product,
  onProductChange,
  query,
  onQueryChange,
  sortColumn,
  sortAscending,
  onSort,
  onSelect,
  onExport,
  selectedPart,
}: PartsTableProps) {
  const costs = calculateCosts(product);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = product.parts.filter((part) => (
      !needle
      || `${part.id} ${part.name} ${part.category} ${part.priceBasis ?? ''}`
        .toLocaleLowerCase()
        .includes(needle)
    ));
    const direction = sortAscending ? 1 : -1;
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'id') comparison = a.id.localeCompare(b.id);
      if (sortColumn === 'name') comparison = a.name.localeCompare(b.name);
      if (sortColumn === 'category') comparison = a.category.localeCompare(b.category);
      if (sortColumn === 'priceType') comparison = (a.priceBasis ?? '').localeCompare(b.priceBasis ?? '');
      if (sortColumn === 'price') comparison = (a.price ?? -1) - (b.price ?? -1);
      if (sortColumn === 'share') {
        comparison = (a.price ?? -1) - (b.price ?? -1);
      }
      return comparison * direction;
    });
  }, [product, query, sortAscending, sortColumn]);

  const exportRows = () => onExport();

  return (
    <section className="section light-section" id="bom">
      <div className="wrap">
        <h2>Parts &amp; prices</h2>
        <p className="lead">
          Every modelled component of the selected product with its allocated price. Click a row to open the part in the 3D explorer.
        </p>
        <div className="table-tools">
          <div className="product-tabs compact-tabs" role="tablist" aria-label="Choose a product for the parts table">
            {(['Smart', 'Connect', 'Vision'] as const).map((key) => (
              <button
                type="button"
                role="tab"
                aria-selected={key === product.key}
                className={`product-tab ${key === product.key ? 'active' : ''}`}
                key={key}
                onClick={() => onProductChange(key)}
              >
                {PRODUCT_NAMES[key]}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by ID, name or category"
            aria-label="Search bill of parts"
          />
          <button type="button" className="chip export-button" onClick={exportRows}>Export CSV</button>
        </div>
        <div className="table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                {sortLabels.map(([column, label]) => (
                  <th key={column} className={column === 'price' || column === 'share' ? 'numeric' : ''}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => onSort(column)}
                      aria-label={`Sort by ${label}`}
                      aria-sort={sortColumn === column ? (sortAscending ? 'ascending' : 'descending') : 'none'}
                    >
                      {label}{sortColumn === column ? (sortAscending ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((part) => {
                const bucket = part.bucketIndex < 0 ? null : product.buckets[part.bucketIndex];
                const share = part.price === null ? null : (part.price / costs.subtotal) * 100;
                return (
                  <tr
                    key={part.id}
                    className={selectedPart === part.name ? 'selected-row' : ''}
                    onClick={() => onSelect(part.name)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(part.name);
                      }
                    }}
                    aria-label={`Select part ${part.id}, ${part.name}`}
                  >
                    <td>{part.id}</td>
                    <td>{part.name}</td>
                    <td>{part.category}</td>
                    <td>
                      {bucket?.label ?? 'No catalog price'}{' '}
                      <span className={`tag ${part.priceType}`}>
                        {part.priceType === 'Q' ? 'Quote' : part.priceType}
                      </span>
                    </td>
                    <td className="numeric">{part.price === null ? 'Quote' : formatMoney(part.price)}</td>
                    <td className="numeric">{share === null ? '—' : `${share.toFixed(2)}%`}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6}>No matching parts.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Parts subtotal ({product.parts.length - product.parts.filter((part) => part.price === null).length} priced, {product.parts.filter((part) => part.price === null).length} quote-only)</td>
                <td className="numeric">{formatMoney(costs.subtotal)}</td><td />
              </tr>
              <tr><td colSpan={4}>Planning contingency (20%)</td><td className="numeric">{formatMoney(costs.contingency)}</td><td /></tr>
              <tr><td colSpan={4}>{COST_LABEL}</td><td className="numeric">{formatMoney(costs.total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

interface CostBreakdownProps {
  products: readonly Product[];
}

export function CostBreakdown({ products }: CostBreakdownProps) {
  const labels = [...new Set(products.flatMap((product) => product.buckets.map((bucket) => bucket.label)))];
  const totals = new Map(products.map((product) => [product.key, calculateCosts(product)]));
  const colors = new Map(labels.map((label, index) => [label, BUCKET_COLORS[index % BUCKET_COLORS.length]]));

  return (
    <section className="section" id="cost">
      <div className="wrap">
        <h2>Cost breakdown</h2>
        <p className="lead">
          Where the prototype budget goes, per cost item and per product. Each product’s {COST_LABEL} is built from catalog line items plus the same 20% planning contingency used in the catalog.
        </p>
        <div className="table-wrap breakdown-wrap">
          <table className="breakdown-table">
            <thead><tr><th>Cost item</th>{products.map((product) => <th className="numeric" key={product.key}>{PRODUCT_NAMES[product.key]}</th>)}</tr></thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label}>
                  <td>{label}</td>
                  {products.map((product) => {
                    const bucket = product.buckets.find((entry) => entry.label === label);
                    return <td className="numeric" key={product.key}>{bucket ? formatMoney(bucket.total) : '–'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Subtotal</td>{products.map((product) => <td className="numeric" key={product.key}>{formatMoney(totals.get(product.key)!.subtotal)}</td>)}</tr>
              <tr><td>Contingency (20%)</td>{products.map((product) => <td className="numeric" key={product.key}>{formatMoney(totals.get(product.key)!.contingency)}</td>)}</tr>
              <tr><td>{COST_LABEL}</td>{products.map((product) => <td className="numeric" key={product.key}>{formatMoney(totals.get(product.key)!.total)}</td>)}</tr>
              <tr><td>Components modelled / quote-only</td>{products.map((product) => <td className="numeric" key={product.key}>{product.parts.length} / {product.parts.filter((part) => part.price === null).length}</td>)}</tr>
            </tfoot>
          </table>
        </div>
        <div className="stack-grid">
          {products.map((product) => {
            const subtotal = totals.get(product.key)!.subtotal;
            return (
              <article className="stack-card" key={product.key}>
                <h3>{PRODUCT_NAMES[product.key]}</h3>
                <div className="stack-bar" aria-label={`${PRODUCT_NAMES[product.key]} subtotal allocation`}>
                  {product.buckets.map((bucket) => (
                    <i
                      key={bucket.code}
                      title={`${bucket.label} ${formatMoney(bucket.total)}`}
                      style={{
                        width: `${(bucket.total / subtotal) * 100}%`,
                        background: colors.get(bucket.label),
                      }}
                    />
                  ))}
                </div>
                <div className="stack-key">
                  {product.buckets.map((bucket) => (
                    <span key={bucket.code}>
                      <i style={{ background: colors.get(bucket.label) }} />
                      {bucket.label} {((bucket.total / subtotal) * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <p className="note">
          For reference, the catalog&apos;s three demonstration budgets are ₱4,452 (Plan A, mobile/bench), ₱37,246 (Plan B, electronics bench) and ₱88,114 (Plan C, AR development). They describe different demonstrations, so they do not equal the per-product totals above.
        </p>
      </div>
    </section>
  );
}

export function BasisNotes() {
  return (
    <section className="section light-section" id="basis">
      <div className="wrap">
        <h2>Basis, assumptions and limits</h2>
        <div className="basis-grid">
          <article className="basis-card">
            <h3>How part prices are set</h3>
            <ul>
              <li>Each product is priced from catalog line items (the camera module, the ESP32-S3 board, microphone, audio, frame and so on).</li>
              <li>A line item&apos;s price is shared across the 3D parts that belong to it. Heavier parts such as the frame take a larger share. This is an allocation, not a price quoted for that piece.</li>
              <li>Price types: <b>S</b> public supplier listing, <b>E</b> planning estimate or plan value from the catalog, <b>Quote</b> no catalog price (needs a supplier quotation).</li>
              <li>{COST_LABEL} is the cost of assembling a demonstration prototype from off-the-shelf development parts, not the cost of manufacturing a production unit.</li>
            </ul>
          </article>
          <article className="basis-card">
            <h3>What is not included</h3>
            <ul>
              <li>Lenses and lens bezels: prescription-lens integration is quotation-only, so these parts are marked Quote and add ₱0 to the total.</li>
              <li>Custom waveguide, optical engine, SoC, PCB, battery pack, tooling, certification, labor, software and AI service costs.</li>
              <li>Connect uses the XREAL AR glasses and adapters as a development stand-in for the 3D AR parts, as in the catalog&apos;s Plan C.</li>
              <li>The model has more parts than a prototype would buy; extra parts share the line item that covers them.</li>
            </ul>
          </article>
          <article className="basis-card">
            <h3>Limits</h3>
            <ul>
              <li>Concept models only: not manufacturing CAD, and no proof of working electronics, optics, AI accuracy, sign-language translation, hazard detection, battery safety or comfort.</li>
              <li>No validated per-unit bill of materials, selling price, margin or profit exists in the team&apos;s documents. The ₱29,000 figure in the market-size activity is a provisional modeled price, not a cost-based price.</li>
              <li>Supplier prices are from the catalog dated 26 October 2026 and may have changed. Part prices are maintained in the app&apos;s source data.</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

export { ACCENTS, PRODUCT_NAMES, PRODUCT_USERS };
