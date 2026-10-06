import React from 'react';
import { render } from '@testing-library/react';
import SeoHead from './SeoHead';

function meta(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('SeoHead', () => {
  it('fija título, descripción, canónica y etiquetas sociales', () => {
    render(
      <SeoHead
        title="La Concha: bandera, tiempo y mareas hoy"
        description="Estado de la playa de La Concha."
        canonicalPath="/playas/suances/la-concha"
      />
    );

    expect(document.title).toBe('La Concha: bandera, tiempo y mareas hoy');
    expect(meta('meta[name="description"]')).toBe('Estado de la playa de La Concha.');
    expect(meta('meta[property="og:title"]')).toBe('La Concha: bandera, tiempo y mareas hoy');
    expect(meta('meta[property="og:description"]')).toBe('Estado de la playa de La Concha.');
    expect(meta('meta[name="twitter:card"]')).toBe('summary');

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    // jsdom serves from localhost; without REACT_APP_SITE_ORIGIN the serving
    // origin is the canonical origin.
    expect(canonical?.href).toBe(`${window.location.origin}/playas/suances/la-concha`);
    expect(meta('meta[property="og:url"]')).toBe(
      `${window.location.origin}/playas/suances/la-concha`
    );
  });

  it('navegar a otra página sobrescribe las etiquetas: no se acumulan', () => {
    render(
      <SeoHead title="Página A" description="Descripción A" canonicalPath="/a" />
    );
    render(
      <SeoHead title="Página B" description="Descripción B" canonicalPath="/b" />
    );

    expect(document.title).toBe('Página B');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('meta[name="description"]')).toBe('Descripción B');
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe(`${window.location.origin}/b`);
  });

  it('noindex marca robots y elimina la canónica y og:url heredadas', () => {
    render(<SeoHead title="Página A" description="a" canonicalPath="/a" />);
    render(<SeoHead title="No encontrada" description="x" canonicalPath="" noindex />);

    expect(meta('meta[name="robots"]')).toBe('noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it('volver a una página normal retira el robots y restaura la canónica', () => {
    render(<SeoHead title="No encontrada" description="x" canonicalPath="" noindex />);
    render(<SeoHead title="Página B" description="b" canonicalPath="/b" />);

    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe(`${window.location.origin}/b`);
  });

  it('reacciona a un cambio de props (idioma, otra playa)', () => {
    const { rerender } = render(
      <SeoHead title="Antes" description="d" canonicalPath="/x" />
    );
    rerender(<SeoHead title="Después" description="d" canonicalPath="/x" />);
    expect(document.title).toBe('Después');
  });
});
