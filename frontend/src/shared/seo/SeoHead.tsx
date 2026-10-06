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

const CANONICAL_ORIGIN =
  process.env.REACT_APP_SITE_ORIGIN?.trim().replace(/\/+$/, '') || null;

/** Absolute canonical URL of a path — also what the share button shares. */
export function canonicalUrl(path: string): string {
  return `${CANONICAL_ORIGIN ?? window.location.origin}${path}`;
}

function metaByName(attribute: 'name' | 'property', value: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, value);
    document.head.appendChild(el);
  }
  return el;
}

const SeoHead: React.FC<{
  title: string;
  description: string;
  /** Canonical PATH of this page (e.g. `/playas/suances/la-concha`). */
  canonicalPath: string;
  /**
   * Not-found/error pages: emits robots=noindex and REMOVES the canonical
   * and og:url instead of inheriting the previous view's — an unknown slug
   * must never keep declaring another beach's URL as its own.
   */
  noindex?: boolean;
}> = ({ title, description, canonicalPath, noindex }) => {
  useEffect(() => {
    const absoluteUrl = canonicalUrl(canonicalPath);

    document.title = title;
    metaByName('name', 'description').setAttribute('content', description);
    metaByName('property', 'og:title').setAttribute('content', title);
    metaByName('property', 'og:description').setAttribute('content', description);
    metaByName('property', 'og:type').setAttribute('content', 'website');
    metaByName('name', 'twitter:card').setAttribute('content', 'summary');

    const existingCanonical =
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const existingRobots =
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const existingOgUrl =
      document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');

    if (noindex) {
      existingCanonical?.remove();
      existingOgUrl?.remove();
      metaByName('name', 'robots').setAttribute('content', 'noindex');
      return;
    }

    existingRobots?.remove();
    metaByName('property', 'og:url').setAttribute('content', absoluteUrl);
    let canonical = existingCanonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = absoluteUrl;
  }, [title, description, canonicalPath, noindex]);

  return null;
};

export default SeoHead;
