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
        titulo="La Concha: bandera, tiempo y mareas hoy"
        descripcion="Estado de la playa de La Concha."
        rutaCanonica="/playas/suances/la-concha"
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
      <SeoHead titulo="Página A" descripcion="Descripción A" rutaCanonica="/a" />
    );
    render(
      <SeoHead titulo="Página B" descripcion="Descripción B" rutaCanonica="/b" />
    );

    expect(document.title).toBe('Página B');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('meta[name="description"]')).toBe('Descripción B');
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe(`${window.location.origin}/b`);
  });

  it('reacciona a un cambio de props (idioma, otra playa)', () => {
    const { rerender } = render(
      <SeoHead titulo="Antes" descripcion="d" rutaCanonica="/x" />
    );
    rerender(<SeoHead titulo="Después" descripcion="d" rutaCanonica="/x" />);
    expect(document.title).toBe('Después');
  });
});
