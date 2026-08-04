/**
 * CHARACTERIZATION — FROZEN.
 *
 * The backend speaks ONLY Spanish. English is produced on the client through two
 * different routes, and the refactor must preserve both:
 *
 *  1. `t('clave')` for the app's own text (`es.ts` / `en.ts`).
 *  2. `traducirTextoApi(textoCrudo, idioma)` for the content that arrives from
 *     the backend, through the tables in `apiText.ts`.
 *
 * Hence the F3/F4 rule: the raw Spanish strings travel all the way down to the
 * leaf and are only translated when painting. A view model that translated in
 * the mapper would break `emojiCielo` and `windSpeedLevel`, which run regexes
 * over that very same Spanish.
 *
 * It is also pinned down that content translation fails SILENTLY: a fragment
 * that is not in the tables comes out in Spanish without warning.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { buildAemetDetail } from '../fixtures/beachDetail';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES, RUTA_DETALLE as DETAILS } from '../apiRoutes';


const AHORA = new Date('2026-07-27T12:00:00.000Z'); // 14:00 in Madrid

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(DETAILS, { json: buildAemetDetail(AHORA) }),
    route(BEACHES, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
});

describe('i18n — texto propio de la app', () => {
  it('traduce el listado al cambiar de idioma', async () => {
    renderWithProviders(<PlayasList />, { route: '/playas', idioma: 'en' });
    await screen.findByText('La Concha');

    expect(screen.getByText('7 beaches')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search beach or municipality...')).toBeInTheDocument();
    // Proper names are NOT translated.
    expect(screen.getByText('La Concha')).toBeInTheDocument();
  });
});

describe('i18n — contenido que viene del backend', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
  });

  it('traduce por diccionario el español crudo del detalle', async () => {
    const { container } = renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3908503',
      path: '/playas/:codigo',
      idioma: 'en',
    });
    await screen.findByText('Swimming conditions (per Red Cross)');

    // t() — app text
    expect(screen.getByText('Tides')).toBeInTheDocument();
    expect(container.querySelector('.flag-value')).toHaveTextContent('Green Flag');
    expect(container.querySelector('.tide-status')).toHaveTextContent('Rising');

    // traducirTextoApi() — backend content, respecting the initial capital letter
    // "cielo despejado" se normaliza a "Sol" y el diccionario lo traduce.
    expect(container.querySelector('.forecast-hero-sky')).toHaveTextContent('Sun');
    expect(screen.getByText('Type').nextElementSibling).toHaveTextContent('Urban');
    expect(screen.getByText('Sand').nextElementSibling).toHaveTextContent('Golden sand');
    expect(screen.getByText('Access').nextElementSibling).toHaveTextContent('On foot · By car');
  });

  it('traduce las descripciones compuestas de viento de AEMET', async () => {
    const { container } = renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3908503',
      path: '/playas/:codigo',
      idioma: 'en',
    });
    await screen.findByText('Swimming conditions (per Red Cross)');

    // "flojo del noreste" is not a table key: it is translated by splitting it
    // into intensity + direction. Before, it came out in Spanish.
    expect(container.querySelector('.wind-turbine-wrap')).toHaveTextContent(
      'Light wind from the northeast',
    );
  });

  it('deja pasar en español el texto libre que no reconoce', async () => {
    const { container } = renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3908503',
      path: '/playas/:codigo',
      idioma: 'en',
    });
    await screen.findByText('Swimming conditions (per Red Cross)');

    // The property is still the same and still frozen: what is unknown passes
    // through in Spanish, without warning. The coastal warnings are free prose
    // from AEMET and are not in any table — and the wind splitter must not
    // touch them either.
    expect(container.querySelector('.aviso-yellow')).toHaveTextContent(
      'Aviso amarillo por oleaje',
    );
  });
});
