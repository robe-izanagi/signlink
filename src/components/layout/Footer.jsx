import { ArrowUpRight } from 'lucide-react';
import { products } from '../../data/products.js';

export default function Footer({ onExplore }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-column">
            <a className="brand" href="#top">
              <span className="brand-mark" aria-hidden="true"><i /><i /></span>
              <span>SIGNLINK</span>
            </a>
            <p>One intelligent platform.<br />Three ways to experience the world.</p>
          </div>
          <div>
            <h3>Discover</h3>
            <ul>
              <li><a href="#products">Products</a></li>
              <li><a href="#technology">Technology</a></li>
              <li><a href="#explore">Explore 3D</a></li>
              <li><a href="#about">About SIGNLINK</a></li>
            </ul>
          </div>
          <div>
            <h3>The collection</h3>
            <ul>
              {products.map((product) => (
                <li key={product.key}>
                  <button onClick={() => onExplore(product.key)}>
                    {product.name.replace('SIGNLINK ', '')}<ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-contact">
            <h3>A concept for what’s next</h3>
            <p>Designed for more connected ways to communicate and experience the world.</p>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SIGNLINK</span>
          <span>
            SIGNLINK Smart, Connect, and Vision are product concepts. Models are illustrative,
            not manufacturing-ready. Proposed features have not been validated and are not available
            for purchase.
          </span>
        </div>
      </div>
    </footer>
  );
}
