import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { IdiomaProvider, Idioma } from '../i18n/IdiomaContext';

interface RenderOptions {
  /** Entrada inicial del router, con query string si hace falta. */
  route?: string;
  /** Patrón de ruta, necesario cuando la página lee `useParams` (p. ej. `/playas/:codigo`). */
  path?: string;
  /** Idioma inicial. Se escribe en localStorage ANTES de montar el provider. */
  idioma?: Idioma;
}

/**
 * Monta un componente con los mismos providers que la app: idioma y router.
 *
 * No usa `IonReactRouter` a propósito. Las páginas solo necesitan el router de
 * React Router v5 (`useHistory`/`useParams`/`useLocation`); montar el outlet de
 * Ionic añadiría la pila de vistas, que no aporta nada en jsdom y sí bastante
 * ruido.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', path, idioma = 'es' }: RenderOptions = {},
): RenderResult {
  localStorage.setItem('app_idioma', idioma);

  return render(
    <IdiomaProvider>
      <MemoryRouter initialEntries={[route]}>
        {path ? <Route path={path}>{ui}</Route> : ui}
      </MemoryRouter>
    </IdiomaProvider>,
  );
}
