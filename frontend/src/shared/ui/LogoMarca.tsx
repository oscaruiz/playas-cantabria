import React from 'react';
import './LogoMarca.css';

/**
 * Region icon shown left of the brand in the sticky headers. Both files are
 * whatever `sync-region` copied for THIS build's region: `/icon-header.png`
 * is the variant redrawn to read at header size (bigger sun, in Cantabria's
 * case), `/icon.png` the install/tab icon a region without a variant falls
 * back to, and the generic favicon covers a region that ships no icon at all
 * — the same rule the manifest uses.
 * Decorative: the brand text right next to it already names the app.
 */
const SOURCES = ['/icon-header.png', '/icon.png', '/favicon.svg'];

const BrandLogo: React.FC = () => (
  <img
    className="marca-logo"
    src={SOURCES[0]}
    alt=""
    aria-hidden="true"
    onError={(event) => {
      const img = event.currentTarget;
      const current = SOURCES.findIndex((f) => img.src.endsWith(f));
      const next = SOURCES[current + 1];
      if (next) img.src = next;
      else img.onerror = null;
    }}
  />
);

export default BrandLogo;
