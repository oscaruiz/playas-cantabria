import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { LanguageProvider, Language } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';

interface RenderOptions {
  /**
   * Initial router entry, with a query string if needed. An ARRAY mounts a
   * history with several entries (last one current), which is what lets a
   * "go back" be tested instead of only asserted on a spy.
   */
  route?: string | string[];
  /** Route pattern, needed when the page reads `useParams` (e.g. `/playas/:codigo`). */
  path?: string;
  /** Initial language. It is written to localStorage BEFORE mounting the provider. */
  language?: Language;
}

/**
 * Mounts a component with the same providers as the app: language and router.
 *
 * It deliberately does not use `IonReactRouter`. The pages only need the
 * React Router v5 router (`useHistory`/`useParams`/`useLocation`); mounting Ionic's
 * outlet would add the view stack, which contributes nothing in jsdom and quite a
 * lot of noise.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', path, language = 'es' }: RenderOptions = {},
): RenderResult {
  localStorage.setItem('app_idioma', language);

  return render(
    <LanguageProvider>
      <MemoryRouter
        initialEntries={Array.isArray(route) ? route : [route]}
        initialIndex={Array.isArray(route) ? route.length - 1 : 0}
      >
        {path ? <Route path={path}>{ui}</Route> : ui}
      </MemoryRouter>
    </LanguageProvider>,
  );
}
