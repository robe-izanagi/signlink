import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Glasses, Sparkles } from 'lucide-react';
import Navigation from './components/layout/Navigation.jsx';
import Footer from './components/layout/Footer.jsx';
import ProductExplorer from './components/sections/ProductExplorer.jsx';
import { products, technology } from './data/products.js';

const ModelViewer = lazy(() => import('./components/product-explorer/ModelViewer.jsx'));

function ProductCard({ product, onExplore }) {
  return (
    <article className={`product-card ${product.className}`}>
      <a
        className="product-card-image"
        href="#explore"
        onClick={(event) => { event.preventDefault(); onExplore(product.key); }}
        aria-label={`Explore ${product.name} in 3D`}
      >
        <img src={product.image} alt={`${product.name} concept model, assembled`} loading="lazy" />
        <span className="image-caption">A product concept</span>
      </a>
      <div className="product-card-body">
        <span className="eyebrow">{product.shortLabel}</span>
        <h3>{product.name}</h3>
        <p className="product-target">For {product.target.toLowerCase()}</p>
        <p>{product.description}</p>
        <ul className="feature-list">
          {product.features.slice(0, 4).map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
        <button className="button button-dark" onClick={() => onExplore(product.key)}>
          Explore product <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function TechnologySection() {
  return (
    <section className="section section-light" id="technology">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">One connected platform</span>
          <h2>The technology behind SIGNLINK</h2>
          <p className="lead">
            Seven building blocks the concept relies on. All are proposed capabilities; none has been
            commercially implemented in SIGNLINK hardware.
          </p>
        </div>
        <div className="technology-grid">
          {technology.map((item, index) => (
            <article className="technology-card" key={item.title}>
              <span className="technology-number">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases({ onExplore }) {
  return (
    <section className="use-cases" id="usecases" aria-label="Product use cases">
      {products.map((product, index) => (
        <article className={`use-case ${product.className}`} key={product.key}>
          <div className="container use-case-layout">
            <div className="use-case-copy">
              <span className="eyebrow">Perspective 0{index + 1}</span>
              <h2>{product.name}</h2>
              <p className="use-case-target">For {product.target}</p>
              <p className="lead">{product.useCaseIntro}</p>
              <ul className="use-case-list">
                {product.useCases.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {product.key === 'Vision' && (
                <p className="safety-note">
                  Awareness alerts are conceptual only. They are not a guarantee of safety and do not
                  replace a cane, guide dog, or other established mobility aid.
                </p>
              )}
            </div>
            <a
              className="use-case-image"
              href="#explore"
              onClick={(event) => { event.preventDefault(); onExplore(product.key); }}
              aria-label={`Inspect ${product.name} components in 3D`}
            >
              <img src={product.image} alt={`${product.name} assembled product concept`} loading="lazy" />
              <span>View in 3D <ArrowUpRight size={16} aria-hidden="true" /></span>
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}

function ComparisonSection() {
  const rows = [
    ['Intended users', ...products.map((product) => product.target)],
    ['Primary functions', ...products.map((product) => product.comparison.primary)],
    ['Display', ...products.map((product) => product.comparison.display)],
    ['Cameras', ...products.map((product) => product.comparison.cameras)],
    ['Audio', ...products.map((product) => product.comparison.audio)],
  ];

  return (
    <section className="section section-light comparison" id="compare">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">At a glance</span>
          <h2>Three perspectives. One platform.</h2>
        </div>
        <div className="comparison-scroll" role="region" aria-label="Product comparison" tabIndex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Designed for</th>
                {products.map((product) => (
                  <th scope="col" className={product.className} key={product.key}>{product.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, ...values]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {values.map((value, index) => <td key={`${label}-${products[index].key}`}>{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">Feature descriptions refer to proposed concepts, not validated or available products.</p>
      </div>
    </section>
  );
}

function AppPromotion() {
  return (
    <section className="app-promotion" id="app">
      <div className="container app-promotion-layout">
        <div className="app-copy">
          <span className="eyebrow">The platform, in your pocket</span>
          <h2>Your SIGNLINK experience, thoughtfully connected.</h2>
          <p className="lead">
            A companion Android app is planned to pair with the glasses. It is not available yet.
          </p>
          <div className="app-download-card">
            <span className="coming-soon">Coming soon</span>
            <strong>SIGNLINK for Android</strong>
            <button className="button button-disabled" disabled aria-disabled="true">
              Download unavailable — coming soon
            </button>
            <p>There is no download yet. We’ll add a real link when the app is released.</p>
          </div>
        </div>
        <div className="phone-stage" aria-label="Concept preview of the planned SIGNLINK mobile app">
          <div className="phone">
            <div className="phone-camera" />
            <div className="phone-brand"><Glasses size={18} /> SIGNLINK</div>
            <div className="phone-greeting"><span>YOUR DAY, IN FOCUS</span><strong>Good morning.</strong></div>
            <div className="phone-preview"><Sparkles size={16} /><span>Your companion is ready</span><i /></div>
            <div className="phone-card"><span>YOUR GLASSES</span><strong>Connected concept</strong><small>Explore your SIGNLINK experience</small></div>
            <div className="phone-nav"><span>⌂</span><span>◉</span><span>○</span><span>◇</span></div>
          </div>
          <span className="phone-orbit phone-orbit-one" />
          <span className="phone-orbit phone-orbit-two" />
          <span className="phone-caption">Concept preview</span>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="section section-light about" id="about">
      <div className="container about-layout">
        <div className="about-heading">
          <span className="eyebrow">Designed around people</span>
          <h2>Why SIGNLINK</h2>
        </div>
        <div>
          <p className="lead">
            Wearable AI is usually designed for one kind of user. SIGNLINK starts from three: people
            who want everyday help, people who communicate in sign language, and people who navigate
            without sight.
          </p>
          <p className="about-copy">
            The three products are meant to share one hardware language and one app, so accessibility
            is part of the platform rather than an add-on.
          </p>
          <p className="concept-disclaimer">
            Every model on this page is a visual concept. Hardware, optics, sensors, and described
            capabilities still need validation by qualified engineers.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [activeProduct, setActiveProduct] = useState('Smart');
  const [heroModelLoaded, setHeroModelLoaded] = useState(false);
  const heroSceneRef = useRef(null);

  const exploreProduct = (key) => {
    setActiveProduct(key);
    document.dispatchEvent(new CustomEvent('signlink:product', { detail: key }));
    document.getElementById('explore')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <>
      <Navigation />
      <main>
        <header className="hero" id="top">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-layout">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> A new way to see what’s possible</span>
              <h1>Technology That Connects <em>Every Perspective.</em></h1>
              <p className="hero-description">
                Meet SIGNLINK — an intelligent smart glasses ecosystem designed for communication,
                accessibility, and everyday assistance.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#products">Discover the collection <ArrowDownRight size={17} /></a>
                <a className="text-link" href="#explore">Explore in 3D <ArrowUpRight size={16} /></a>
              </div>
              <div className="hero-footnote">
                <span className="hero-footnote-line" />
                <span>One intelligent platform. Three ways to experience the world.<br /><b>A product concept — not yet a shipping product.</b></span>
              </div>
            </div>
            <div className="hero-art">
              <div className="hero-art-label"><span>01 / 03</span><span>SMART · CONCEPT MODEL</span></div>
              <div className={`hero-image${heroModelLoaded ? ' is-loaded' : ''}`}>
                <img
                  src={products[0].image}
                  alt={heroModelLoaded ? '' : 'SIGNLINK Smart concept glasses, assembled'}
                  aria-hidden={heroModelLoaded}
                  fetchPriority="high"
                />
                <Suspense fallback={null}>
                  <ModelViewer
                    accent={products[0].accent}
                    enabled
                    isHero
                    productKey="Smart"
                    sceneRef={heroSceneRef}
                    onLoaded={() => setHeroModelLoaded(true)}
                    onError={() => setHeroModelLoaded(false)}
                  />
                </Suspense>
                <div className="hero-image-glow" />
                <div className="hero-orbit hero-orbit-a" />
                <div className="hero-orbit hero-orbit-b" />
              </div>
              <a className="hero-product-link" href="#explore" onClick={() => exploreProduct('Smart')}>
                <span>Take a closer look</span><ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <a className="scroll-cue" href="#products"><span>Scroll to discover</span><span className="scroll-cue-line" /></a>
        </header>

        <section className="section section-light products-section" id="products">
          <div className="container">
            <div className="section-heading section-heading-split">
              <div>
                <span className="eyebrow">A vision for everyone</span>
                <h2>Three products.<br /><span>One platform.</span></h2>
              </div>
              <p className="lead">
                Each variant is a product concept designed around a different way of experiencing the
                world. Features listed are proposed, not yet validated.
              </p>
            </div>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.key} product={product} onExplore={exploreProduct} />
              ))}
            </div>
          </div>
        </section>

        <ProductExplorer activeProduct={activeProduct} onProductChange={setActiveProduct} />
        <TechnologySection />
        <UseCases onExplore={exploreProduct} />
        <ComparisonSection />
        <AppPromotion />
        <AboutSection />
      </main>
      <Footer onExplore={exploreProduct} />
    </>
  );
}
