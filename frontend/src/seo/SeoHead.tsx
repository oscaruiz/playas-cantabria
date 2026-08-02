import React, { useEffect } from 'react';

/**
 * Per-route document head: title, description, canonical and social tags —
 * without a dependency (react-helmet-async would cost real kilobytes of a
 * budget measured in single digits, to do this). Each page renders one
 * SeoHead; tags are upserted in place, so navigating simply overwrites them.
 *
 * Title ownership moved HERE from IdiomaContext: parent effects run after
 * child effects, so a provider-level title would overwrite the page's on
 * every language switch. Pages re-render on idioma change (their texts come
 * from t()), which re-runs this effect with the translated title.
 *
 * The canonical URL is absolute. Its origin comes from REACT_APP_SITE_ORIGIN
 * when the build sets it, else from where the app is actually served —
 * correct whenever the serving domain IS the canonical domain, which is the
 * case for one Firebase site per region.
 */

const ORIGEN_CANONICO =
  process.env.REACT_APP_SITE_ORIGIN?.trim().replace(/\/+$/, '') || null;

function metaPorNombre(atributo: 'name' | 'property', valor: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${valor}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(atributo, valor);
    document.head.appendChild(el);
  }
  return el;
}

const SeoHead: React.FC<{
  titulo: string;
  descripcion: string;
  /** Canonical PATH of this page (e.g. `/playas/suances/la-concha`). */
  rutaCanonica: string;
}> = ({ titulo, descripcion, rutaCanonica }) => {
  useEffect(() => {
    const origen = ORIGEN_CANONICO ?? window.location.origin;
    const urlCanonica = `${origen}${rutaCanonica}`;

    document.title = titulo;
    metaPorNombre('name', 'description').setAttribute('content', descripcion);
    metaPorNombre('property', 'og:title').setAttribute('content', titulo);
    metaPorNombre('property', 'og:description').setAttribute('content', descripcion);
    metaPorNombre('property', 'og:url').setAttribute('content', urlCanonica);
    metaPorNombre('property', 'og:type').setAttribute('content', 'website');
    metaPorNombre('name', 'twitter:card').setAttribute('content', 'summary');

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = urlCanonica;
  }, [titulo, descripcion, rutaCanonica]);

  return null;
};

export default SeoHead;
