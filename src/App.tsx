import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, Dispatch, RefObject } from 'react';
import ExplorerViewer from './components/ExplorerViewer';
import MiniViewer from './components/MiniViewer';
import {
  ACCENTS,
  BasisNotes,
  CostBreakdown,
  PRODUCT_NAMES,
  PartsTable,
  SummaryCards,
} from './components/ReviewSections';
import type { SortColumn } from './components/ReviewSections';
import { getProducts } from './data/signlinkData';
import type { Part, Product, ProductKey } from './data/signlinkData';
import { BASE } from './lib/assets';
import { COST_LABEL } from './lib/costLabel';
import { buildPartsCsv } from './lib/csv';
import { formatMoney } from './lib/format';
import { calculateCosts } from './lib/pricing';
import type { LabelMode } from './three/Viewer';
import type { ExplorerViewerHandle } from './components/ExplorerViewer';
import './styles/index.css';

const products = getProducts();
const productsByKey = Object.fromEntries(products.map((product) => [product.key, product])) as Record<ProductKey, Product>;
const productParts: Record<ProductKey, Part[]> = {
  Smart: productsByKey.Smart.parts,
  Connect: productsByKey.Connect.parts,
  Vision: productsByKey.Vision.parts,
};

interface AppState {
  productKey: ProductKey;
  selectedPart: string | null;
  explosion: number;
  animating: boolean;
  labelMode: LabelMode;
  heatmap: boolean;
  autoRotate: boolean;
  categories: Set<string>;
  search: string;
  bomSearch: string;
  sortColumn: SortColumn;
  sortAscending: boolean;
  started: boolean;
  loaded: boolean;
  loading: boolean;
  progress: number | null;
  error: string | null;
  denseLabels: boolean;
}

type AppAction =
  | { type: 'product'; key: ProductKey }
  | { type: 'selectedPart'; name: string | null }
  | { type: 'explosion'; value: number }
  | { type: 'animation'; value: boolean }
  | { type: 'labelMode'; value: LabelMode }
  | { type: 'heatmap'; value: boolean }
  | { type: 'autoRotate'; value: boolean }
  | { type: 'category'; value: string }
  | { type: 'clearCategories' }
  | { type: 'search'; value: string }
  | { type: 'bomSearch'; value: string }
  | { type: 'sort'; column: SortColumn }
  | { type: 'started' }
  | { type: 'loading' }
  | { type: 'progress'; value: number | null }
  | { type: 'loaded' }
  | { type: 'error'; message: string }
  | { type: 'denseLabels'; value: boolean };

const initialState: AppState = {
  productKey: 'Smart',
  selectedPart: null,
  explosion: 0,
  animating: false,
  labelMode: 'off',
  heatmap: false,
  autoRotate: true,
  categories: new Set(),
  search: '',
  bomSearch: '',
  sortColumn: 'id',
  sortAscending: true,
  started: false,
  loaded: false,
  loading: false,
  progress: null,
  error: null,
  denseLabels: false,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'product':
      return {
        ...state,
        productKey: action.key,
        selectedPart: null,
        explosion: 0,
        animating: false,
        categories: new Set(),
        loaded: false,
        loading: state.started,
        progress: null,
        error: null,
      };
    case 'selectedPart': return { ...state, selectedPart: action.name };
    case 'explosion': return { ...state, explosion: action.value, animating: false };
    case 'animation': return { ...state, animating: action.value };
    case 'labelMode': return { ...state, labelMode: action.value };
    case 'heatmap': return { ...state, heatmap: action.value };
    case 'autoRotate': return { ...state, autoRotate: action.value };
    case 'category': {
      const categories = new Set(state.categories);
      if (categories.has(action.value)) categories.delete(action.value);
      else categories.add(action.value);
      return { ...state, categories };
    }
    case 'clearCategories': return { ...state, categories: new Set() };
    case 'search': return { ...state, search: action.value };
    case 'bomSearch': return { ...state, bomSearch: action.value };
    case 'sort':
      return {
        ...state,
        sortColumn: action.column,
        sortAscending: state.sortColumn === action.column ? !state.sortAscending : true,
      };
    case 'started': return { ...state, started: true };
    case 'loading': return { ...state, loading: true, loaded: false, error: null, progress: null };
    case 'progress': return { ...state, progress: action.value };
    case 'loaded':
      return { ...state, loaded: true, loading: false, error: null, progress: 1 };
    case 'error':
      return { ...state, loaded: false, loading: false, error: action.message };
    case 'denseLabels': return { ...state, denseLabels: action.value };
  }
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function downloadCsv(product: Product): void {
  const url = URL.createObjectURL(new Blob([buildPartsCsv(product)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `SIGNLINK_${product.key}_parts_prices.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface PartCardProps {
  product: Product;
  part: Part | null;
  onDeselect: () => void;
}

function PartCard({ product, part, onDeselect }: PartCardProps) {
  const [rotating, setRotating] = useState(false);
  const [miniError, setMiniError] = useState('');
  const costs = calculateCosts(product);
  const imageBase = `${BASE}part_assets`;
  const assetSlug = part ? `${part.id}_${slug(part.name)}` : '';
  const imageUrl = part
    ? `${imageBase}/images/${product.key}/${assetSlug}.png`
    : '';
  const miniPath = part
    ? `part_assets/glb/${product.key}/${assetSlug}.glb`
    : '';
  const handleMiniError = useCallback((message: string) => {
    setMiniError(message);
    setRotating(false);
  }, []);

  useEffect(() => {
    setRotating(false);
    setMiniError('');
  }, [product.key, part?.id]);

  if (!part) {
    return (
      <div className="panel part-card empty-part" aria-live="polite">
        <h3>Select a part</h3>
        <p>Click a part in the model, a label, or the list to see its image, function, location and price.</p>
      </div>
    );
  }
  const bucket = part.bucketIndex < 0 ? null : product.buckets[part.bucketIndex];
  const share = part.price === null ? '—' : `${((part.price / costs.subtotal) * 100).toFixed(2)}% of subtotal`;

  return (
    <div className="panel part-card" aria-live="polite" aria-atomic="true">
      <div className="part-image-frame">
        {!rotating && <img className="part-image" src={imageUrl} alt={part.name} loading="lazy" />}
        {rotating && <MiniViewer path={miniPath} label={part.name} onError={handleMiniError} />}
      </div>
      {miniError && <p className="mini-error" role="alert">{miniError}</p>}
      <div className="part-card-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            setMiniError('');
            setRotating((value) => !value);
          }}
        >
          {rotating ? 'Show image' : 'Rotate this part'}
        </button>
        <button type="button" className="button button-outline" onClick={onDeselect}>Deselect</button>
      </div>
      <h3><span className="tag part-id-tag">{part.id}</span> {part.name}</h3>
      <p className="part-description">{part.description}</p>
      <div className="part-price">
        {part.price === null ? 'Quote needed' : formatMoney(part.price)}
        <span className={`tag ${part.priceType}`}>{part.priceType === 'Q' ? 'Quote' : part.priceType}</span>
      </div>
      <dl className="part-meta">
        <dt>Category</dt><dd>{part.category}</dd>
        <dt>Location</dt><dd>{part.location}</dd>
        <dt>Price basis</dt>
        <dd>{bucket ? `${bucket.label} — ${bucket.basis}` : 'No catalog price; supplier quotation needed (not in total)'}</dd>
        <dt>Share</dt><dd>{share}</dd>
      </dl>
    </div>
  );
}

interface ExplorerProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  viewerRef: RefObject<ExplorerViewerHandle>;
  product: Product;
  selectedPart: Part | null;
}

function Explorer({
  state,
  dispatch,
  viewerRef,
  product,
  selectedPart,
}: ExplorerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const costs = calculateCosts(product);
  const categories = [...new Set(product.parts.map((part) => part.category))].sort();
  const filteredParts = product.parts.filter((part) => {
    const filter = state.search.trim().toLocaleLowerCase();
    return (!state.categories.size || state.categories.has(part.category))
      && (!filter || `${part.id} ${part.name} ${part.category}`.toLocaleLowerCase().includes(filter));
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || state.started) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      dispatch({ type: 'started' });
      observer.disconnect();
    }, { rootMargin: '400px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, [dispatch, state.started]);

  useEffect(() => {
    if (state.started) viewerRef.current?.load(state.productKey);
  }, [state.productKey, state.started, viewerRef]);
  useEffect(() => {
    viewerRef.current?.select(state.selectedPart);
  }, [state.loaded, state.selectedPart, viewerRef]);
  useEffect(() => {
    viewerRef.current?.setExplosion(state.explosion / 100);
  }, [state.explosion, viewerRef]);

  const choosePart = (name: string | null) => {
    dispatch({ type: 'selectedPart', name: state.selectedPart === name ? null : name });
  };
  return (
    <section className="section explorer-section" id="explore" ref={sectionRef} style={{ '--accent': ACCENTS[product.key] } as CSSProperties}>
      <div className="wrap">
        <h2>3D explorer</h2>
        <p className="lead">
          Drag to rotate · scroll to zoom · explode to separate every part · switch on names to label parts · click any part for its image and price.
        </p>
        <div className="product-tabs" role="tablist" aria-label="Select a product">
          {products.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item.key === product.key}
              key={item.key}
              onClick={() => dispatch({ type: 'product', key: item.key })}
            >
              {PRODUCT_NAMES[item.key]}
            </button>
          ))}
        </div>

        <div className="explorer-layout">
          <div className="viewer-column">
            <div className="viewer-frame">
              <div className="viewer-stage">
                <ExplorerViewer
                  ref={viewerRef}
                  product={product.key}
                  productParts={productParts}
                  accent={ACCENTS[product.key]}
                  labelMode={state.labelMode}
                  categories={state.categories}
                  heatmap={state.heatmap}
                  autoRotate={state.autoRotate}
                  onLoading={() => dispatch({ type: 'loading' })}
                  onProgress={(progress) => dispatch({ type: 'progress', value: progress })}
                  onLoaded={() => dispatch({ type: 'loaded' })}
                  onError={(error) => dispatch({ type: 'error', message: error.message })}
                  onPick={(part) => dispatch({ type: 'selectedPart', name: part?.name ?? null })}
                  onExplosion={(value, animating) => {
                    dispatch({ type: 'explosion', value: Math.round(value * 100) });
                    dispatch({ type: 'animation', value: animating });
                  }}
                  onAutoRotate={(enabled) => dispatch({ type: 'autoRotate', value: enabled })}
                  onDenseLabels={(dense) => dispatch({ type: 'denseLabels', value: dense })}
                />
                <div className="viewer-hint">Drag to rotate · tap a part or label to inspect</div>
                <div className="viewer-dense" role="status">{state.denseLabels ? 'Too many names to fit. Pick a category to name those parts.' : ''}</div>
                {state.heatmap && <div className="heat-legend"><span>low</span><i /><span>high price</span></div>}
                {(state.loading || state.error) && (
                  <div className="viewer-overlay" role={state.error ? 'alert' : 'status'}>
                    {state.error ? (
                      <>
                        <p>Couldn&apos;t load {PRODUCT_NAMES[product.key]}. {state.error}</p>
                        <button type="button" className="button button-outline" onClick={() => viewerRef.current?.load(product.key)}>Try again</button>
                      </>
                    ) : (
                      <>
                        <p>Loading {PRODUCT_NAMES[product.key]}…</p>
                        <div
                          className="loading-bar"
                          role="progressbar"
                          aria-label="Model loading"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={state.progress === null ? 12 : Math.round(state.progress * 100)}
                        >
                          <i style={{ width: `${state.progress === null ? 12 : Math.max(6, state.progress * 100)}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="controls">
              <div className="control-row">
                <button type="button" className="button button-primary" disabled={!state.loaded} onClick={() => viewerRef.current?.animateExplosion(1)}>Explode</button>
                <button type="button" className="button button-outline" disabled={!state.loaded} onClick={() => viewerRef.current?.animateExplosion(0)}>Assemble</button>
                <button type="button" className="button button-outline" disabled={!state.animating} onClick={() => viewerRef.current?.pause()}>Pause</button>
                <label className="explosion-control">
                  <span>Explosion</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={state.explosion}
                    aria-label="Explosion amount"
                    disabled={!state.loaded}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      viewerRef.current?.pause();
                      dispatch({ type: 'explosion', value });
                      viewerRef.current?.setExplosion(value / 100);
                    }}
                  />
                  <output>{state.explosion}%</output>
                </label>
              </div>
              <div className="control-row secondary-controls">
                <button type="button" className={`button ${state.autoRotate ? 'on' : 'button-outline'}`} aria-pressed={state.autoRotate} onClick={() => {
                  const enabled = !state.autoRotate;
                  dispatch({ type: 'autoRotate', value: enabled });
                  viewerRef.current?.setAutoRotate(enabled);
                }}>Auto-rotate</button>
                <label className="names-select">Names
                  <select
                    aria-label="Part labels"
                    value={state.labelMode}
                    onChange={(event) => dispatch({ type: 'labelMode', value: event.target.value as LabelMode })}
                  >
                    <option value="off">Off</option>
                    <option value="ids">Part IDs</option>
                    <option value="names">Part names</option>
                  </select>
                </label>
                <button type="button" className={`button ${state.heatmap ? 'on' : 'button-outline'}`} aria-pressed={state.heatmap} onClick={() => dispatch({ type: 'heatmap', value: !state.heatmap })}>Cost heatmap</button>
                {([
                  ['front', 'Front'],
                  ['side', 'Side'],
                  ['top', 'Top'],
                  ['threeQuarter', '3/4'],
                ] as const).map(([view, label]) => (
                  <button type="button" className="button button-outline" key={view} onClick={() => {
                    viewerRef.current?.setView(view);
                    dispatch({ type: 'autoRotate', value: false });
                  }}>{label}</button>
                ))}
                <button type="button" className="button button-outline" disabled={!state.loaded} onClick={() => {
                  viewerRef.current?.pause();
                  viewerRef.current?.setExplosion(0);
                  dispatch({ type: 'explosion', value: 0 });
                  dispatch({ type: 'selectedPart', name: null });
                  viewerRef.current?.resetView();
                  viewerRef.current?.setAutoRotate(true);
                }}>Reset all</button>
              </div>
            </div>
          </div>

          <aside className="side-panel">
            <div className="panel cost-panel">
              <span>{COST_LABEL}</span>
              <strong>{formatMoney(costs.total)}</strong>
              <small>{formatMoney(costs.subtotal)} subtotal + {formatMoney(costs.contingency)} contingency · {product.parts.filter((part) => part.price === null).length} quote-only parts · estimate</small>
            </div>
            <PartCard product={product} part={selectedPart} onDeselect={() => dispatch({ type: 'selectedPart', name: null })} />
            <div className="panel parts-filter-panel">
              <input
                type="search"
                value={state.search}
                onChange={(event) => dispatch({ type: 'search', value: event.target.value })}
                placeholder="Search parts"
                aria-label="Search parts"
              />
              <div className="category-chips" aria-label="Filter part names by category">
                <button type="button" className={`chip ${state.categories.size ? '' : 'on'}`} onClick={() => dispatch({ type: 'clearCategories' })}>All</button>
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={`chip ${state.categories.has(category) ? 'on' : ''}`}
                    aria-pressed={state.categories.has(category)}
                    onClick={() => dispatch({ type: 'category', value: category })}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <ul className="parts-list" aria-label={`${PRODUCT_NAMES[product.key]} parts`}>
                {filteredParts.map((part) => (
                  <li key={part.id}>
                    <button
                      type="button"
                      aria-current={state.selectedPart === part.name ? 'true' : undefined}
                      onClick={() => choosePart(part.name)}
                    >
                      <b>{part.id}</b><span>{part.name}</span><span className="list-price">{part.price === null ? 'Quote' : formatMoney(part.price)}</span>
                    </button>
                  </li>
                ))}
                {!filteredParts.length && <li className="no-results">No matching parts.</li>}
              </ul>
            </div>
            <span className="screen-reader-only" aria-live="polite">{state.loaded ? `${product.parts.length} parts loaded` : ''}</span>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const viewerRef = useRef<ExplorerViewerHandle>(null);
  const product = productsByKey[state.productKey];
  const selectedPart = useMemo(
    () => product.parts.find((part) => part.name === state.selectedPart) ?? null,
    [product, state.selectedPart],
  );
  const activateProduct = (key: ProductKey) => {
    dispatch({ type: 'product', key });
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  };
  const handleTableSelect = (name: string) => {
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
    dispatch({ type: 'selectedPart', name });
  };
  return (
    <>
      <nav className="site-nav">
        <div className="wrap nav-inner">
          <a className="logo" href="#top">SIGNLINK</a>
          <div className="nav-links">
            <a href="#summary">Summary</a>
            <a href="#explore">3D explorer</a>
            <a href="#bom">Parts &amp; prices</a>
            <a href="#cost">Cost breakdown</a>
            <a href="#basis">Basis &amp; limits</a>
          </div>
          <span className="review-pill">Prototype review · estimates only</span>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap">
          <h1>SIGNLINK prototype review</h1>
          <p className="lead">
            Three smart-glasses concepts, 295 modelled components, and what the prototype build would cost. Rotate the models, break them apart, and see the price assigned to every part.
          </p>
          <div id="summary"><SummaryCards products={products} onExplore={activateProduct} /></div>
          <p className="note">
            <b>Read this first.</b> These are concept 3D models and planning estimates built from the team&apos;s Resource &amp; Cost Catalog. They are prototype-build costs using development stand-ins, not validated manufacturing costs, a supplier quotation, a selling price or a profit forecast.
          </p>
        </div>
      </header>

      <main>
        <Explorer
          state={state}
          dispatch={dispatch}
          viewerRef={viewerRef}
          product={product}
          selectedPart={selectedPart}
        />
        <PartsTable
          product={product}
          onProductChange={activateProduct}
          query={state.bomSearch}
          onQueryChange={(value) => dispatch({ type: 'bomSearch', value })}
          sortColumn={state.sortColumn}
          sortAscending={state.sortAscending}
          onSort={(column) => dispatch({ type: 'sort', column })}
          onSelect={handleTableSelect}
          onExport={() => downloadCsv(product)}
          selectedPart={state.selectedPart}
        />
        <CostBreakdown products={products} />
        <BasisNotes />
      </main>
      <footer>
        <div className="wrap">SIGNLINK · ENGG 405 Technopreneurship · concept prototype review. Models: SIGNLINK 3D Concepts v5 (Smart 95, Connect 106, Vision 94 components). All figures in Philippine peso.</div>
      </footer>
    </>
  );
}
