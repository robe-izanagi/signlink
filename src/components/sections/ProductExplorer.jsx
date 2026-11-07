import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Maximize2,
  Minus,
  Move3D,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { products } from '../../data/products.js';

const ModelViewer = lazy(() => import('../product-explorer/ModelViewer.jsx'));

function componentLocation(name) {
  const sideMatch = name.match(/\b(Left|Right)\b/);
  const side = sideMatch?.[1];
  if (/Hand-Sign/.test(name)) return 'Underside of the front frame, facing down';
  if (/Temple|Hinge|Speaker|Battery|Control PCB|Main Control|USB|Button|LED|Haptic|Control Strip|Touch|Earpiece/.test(name)) {
    return `${side ? `${side} ` : ''}temple (side arm)`;
  }
  if (/Bridge|Nose/.test(name)) return 'Central front frame, at the nose bridge';
  return `Front frame${side ? `, ${side.toLowerCase()} side` : ''}`;
}

function ComponentInformation({ part, onDeselect }) {
  if (!part) {
    return (
      <div className="component-empty">
        <span className="component-empty-icon"><Move3D size={18} /></span>
        <div>
          <h3>Select a component</h3>
          <p>Tap a part in the viewer or choose one from the list to see its ID, function, type, and location.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="component-information" aria-live="polite">
      <div className="component-info-topline"><span>Component details</span><button onClick={onDeselect} aria-label="Deselect component"><X size={15} /></button></div>
      <span className="component-id">{part.id}</span>
      <h3>{part.name}</h3>
      <p className="component-description">{part.description}</p>
      <dl>
        <div><dt>Location</dt><dd>{componentLocation(part.name)}</dd></div>
        <div><dt>Type</dt><dd>{part.role.replace(/_/g, ' ')}</dd></div>
        <div><dt>Exploded offset</dt><dd>{part.explodedOffset.map((value) => `${Math.round(value * 1000)} mm`).join(' / ')}</dd></div>
      </dl>
      <button className="component-deselect" onClick={onDeselect}>Clear selection <X size={14} /></button>
    </div>
  );
}

export default function ProductExplorer({ activeProduct, onProductChange }) {
  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [amount, setAmount] = useState(0);
  const [query, setQuery] = useState('');
  const [controlsOpen, setControlsOpen] = useState(true);
  const sectionRef = useRef(null);
  const sceneRef = useRef(null);
  const product = products.find((item) => item.key === activeProduct) ?? products[0];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEntered(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const filteredParts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return parts.filter((part) => !term || `${part.id} ${part.name} ${part.role}`.toLowerCase().includes(term));
  }, [parts, query]);

  const handleLoading = () => {
    setLoading(true);
    setError('');
    setParts([]);
    setSelectedPart(null);
    setAmount(0);
    setProgress(null);
  };

  const selectPart = (name) => {
    const next = name && selectedPart?.name !== name ? parts.find((part) => part.name === name) : null;
    setSelectedPart(next ?? null);
    sceneRef.current?.setSelected(next?.name ?? null);
  };

  const setExplosionAmount = (value) => {
    const nextAmount = Math.max(0, Math.min(100, Number(value)));
    setAmount(nextAmount);
    if (sceneRef.current) {
      sceneRef.current.explosionGoal = nextAmount / 100;
      sceneRef.current.setExplosion(nextAmount / 100, true);
    }
  };

  const animateTo = (value) => {
    sceneRef.current?.animateExplosion(value);
  };

  const resetView = () => sceneRef.current?.frameModel(true);
  const resetAll = () => {
    sceneRef.current?.animateExplosion(0);
    selectPart(null);
    sceneRef.current?.frameModel(true);
  };

  return (
    <section className={`section product-explorer ${product.className}`} id="explore" ref={sectionRef}>
      <div className="container">
        <div className="explorer-heading">
          <div className="section-heading">
            <span className="eyebrow">Inside the idea</span>
            <h2>Explore the hardware <em>in 3D.</em></h2>
            <p className="lead">
              Rotate, zoom, pull the parts apart and select any component. Models load only when you
              reach the explorer and choose a product.
            </p>
          </div>
          <div className="explorer-note"><CircleHelp size={17} /><span>Every component is individually named and mapped to the supplied design references.</span></div>
        </div>

        <div className="product-tabs" role="tablist" aria-label="Choose a product to explore">
          {products.map((item, index) => (
            <button
              className={`product-tab ${item.className}`}
              key={item.key}
              id={`tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={item.key === product.key}
              aria-controls="product-model-panel"
              onClick={() => onProductChange(item.key)}
            >
              <span className="tab-index">0{index + 1}</span><span>{item.name}</span>
              {item.key === product.key && <span className="tab-active-mark" />}
            </button>
          ))}
        </div>

        <div className="explorer-layout" id="product-model-panel" role="tabpanel" aria-labelledby={`tab-${product.key}`}>
          <div className="viewer-column">
            <div className="viewer-frame" aria-busy={loading}>
              <div className="viewer-topline"><span>01 — {product.name.toUpperCase()}</span><span>CONCEPT MODEL · 3D INTERACTIVE</span></div>
              <div className="viewer-stage">
                <Suspense fallback={<div className="viewer-overlay" role="status"><div className="loading-indicator"><i /><i /><i /></div><p>Preparing the 3D viewer…</p></div>}>
                  <ModelViewer
                    accent={product.accent}
                    enabled={entered}
                    productKey={product.key}
                    sceneRef={sceneRef}
                    onLoading={handleLoading}
                    onProgress={setProgress}
                    onLoaded={() => { setLoading(false); setError(''); }}
                    onError={(reason) => { setLoading(false); setError(reason.message || 'The 3D model could not be loaded.'); }}
                    onParts={setParts}
                    onSelect={setSelectedPart}
                    onAmount={(value) => setAmount(Math.round(value * 100))}
                    onPick={selectPart}
                  />
                </Suspense>
                <div className="viewer-gradient" aria-hidden="true" />
                <div className="viewer-hint"><Move3D size={15} /> Drag to rotate <span>·</span> Scroll to zoom <span>·</span> Select a part</div>
                {!entered && (
                  <div className="viewer-overlay"><div className="loading-indicator"><i /><i /><i /></div><p>Preparing the interactive model…</p></div>
                )}
                {entered && loading && (
                  <div className="viewer-overlay" role="status">
                    <div className="loading-indicator"><i /><i /><i /></div>
                    <p>Loading {product.name}…</p>
                    <div className="loading-progress"><span style={{ width: progress == null ? '35%' : `${Math.max(progress * 100, 5)}%` }} /></div>
                  </div>
                )}
                {entered && error && (
                  <div className="viewer-overlay viewer-error" role="alert">
                    <span className="error-mark">!</span>
                    <p>{error}</p>
                    <button className="button button-outline" onClick={() => sceneRef.current?.load(product.key).catch((reason) => setError(reason.message))}>Try again</button>
                  </div>
                )}
                <span className="viewer-accent-label">{product.key} / 01</span>
              </div>
            </div>

            <div className="viewer-controls">
              <div className="control-actions">
                <button className="button button-explode" onClick={() => animateTo(1)} disabled={!parts.length}>
                  <Box size={16} /> Explode
                </button>
                <button className="button button-outline" onClick={() => animateTo(0)} disabled={!parts.length}>
                  <RotateCcw size={15} /> Assemble
                </button>
                <button className="button button-icon" onClick={resetView} disabled={!parts.length} aria-label="Reset camera view" title="Reset camera view">
                  <Maximize2 size={16} />
                </button>
                <button className="button button-icon" onClick={resetAll} disabled={!parts.length} aria-label="Reset model and selection" title="Reset model and selection">
                  <RotateCcw size={16} />
                </button>
              </div>
              <div className="explosion-control">
                <label htmlFor="explosion-range"><span>EXPLOSION</span><output htmlFor="explosion-range">{amount}%</output></label>
                <input
                  id="explosion-range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={amount}
                  style={{ '--range-progress': `${amount}%` }}
                  onChange={(event) => setExplosionAmount(event.target.value)}
                  disabled={!parts.length}
                />
                <div className="range-labels"><span>Assembled</span><span>Exploded</span></div>
              </div>
            </div>
            <p className="gesture-note"><span>↔</span> Drag to rotate <span>⌕</span> Scroll or pinch to zoom <span>⇧</span> Right-drag to pan</p>
          </div>

          <aside className="component-panel" aria-label={`${product.name} components`}>
            <div className="component-panel-header">
              <div><span className="eyebrow">Hardware index</span><h3>Component explorer</h3></div>
              <span className="component-count">{parts.length || '—'} <span>PARTS</span></span>
            </div>
            <ComponentInformation part={selectedPart} onDeselect={() => selectPart(null)} />
            <div className="component-list-heading">
              <span>All components</span>
              <button onClick={() => setControlsOpen((open) => !open)} aria-expanded={controlsOpen} aria-label="Toggle component list">
                <ChevronDown size={17} />
              </button>
            </div>
            {controlsOpen && (
              <>
                <label className="component-search">
                  <Search size={16} aria-hidden="true" />
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or ID" aria-label="Search components" />
                  {query && <button onClick={() => setQuery('')} aria-label="Clear component search"><X size={14} /></button>}
                </label>
                <ul className="component-list" aria-label="Components">
                  {filteredParts.map((part) => (
                    <li key={part.id}>
                      <button
                        type="button"
                        aria-current={selectedPart?.name === part.name ? 'true' : undefined}
                        onClick={() => selectPart(part.name)}
                      >
                        <span className="component-list-id">{part.id}</span><span className="component-list-name">{part.name}</span>
                        {selectedPart?.name === part.name ? <Check size={14} /> : <Plus className="component-list-plus" size={14} />}
                      </button>
                    </li>
                  ))}
                  {filteredParts.length === 0 && (
                    <li className="component-no-results"><Minus size={14} />No matching components.</li>
                  )}
                  {parts.length === 0 && !loading && !error && entered && (
                    <li className="component-no-results">Component list will appear when the model is ready.</li>
                  )}
                </ul>
              </>
            )}
            <p className="component-panel-footnote">Component names and descriptions follow the supplied design references.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
