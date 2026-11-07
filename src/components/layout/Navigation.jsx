import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';

const links = [
  ['Overview', '#top'],
  ['Products', '#products'],
  ['Technology', '#technology'],
  ['Explore 3D', '#explore'],
  ['About', '#about'],
];

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="container nav-content">
        <a className="brand" href="#top" onClick={closeMenu} aria-label="SIGNLINK home">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>SIGNLINK</span>
        </a>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <ul className={`nav-links${menuOpen ? ' is-open' : ''}`} id="primary-menu">
          {links.map(([label, href]) => (
            <li key={href}><a href={href} onClick={closeMenu}>{label}</a></li>
          ))}
        </ul>
        <a className="button button-nav" href="#app" onClick={closeMenu}>
          Get the app <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
}
