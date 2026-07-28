/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * El backend habla SOLO español. El inglés se produce en cliente por dos vías
 * distintas, y el refactor debe conservar las dos:
 *
 *  1. `t('clave')` para el texto propio de la app (`es.ts` / `en.ts`).
 *  2. `traducirTextoApi(textoCrudo, idioma)` para el contenido que llega del
 *     backend, mediante las tablas de `apiText.ts`.
 *
 * De ahí la regla de F3/F4: las cadenas españolas crudas viajan hasta la hoja y
 * solo se traducen al pintar. Un view model que tradujese en el mapper rompería
 * `emojiCielo` y `windSpeedLevel`, que hacen regex sobre ese mismo español.
 *
 * También queda fijado que la traducción de contenido falla EN SILENCIO: un
 * fragmento que no esté en las tablas sale en español sin aviso.
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

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;
const DETAILS = /\/api\/beaches\/[^/]+\/details$/;

const AHORA = new Date('2026-07-27T12:00:00.000Z'); // 14:00 en Madrid

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
    // Los nombres propios NO se traducen.
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

    // t() — texto de la app
    expect(screen.getByText('Tides')).toBeInTheDocument();
    expect(container.querySelector('.flag-value')).toHaveTextContent('Green Flag');
    expect(container.querySelector('.tide-status')).toHaveTextContent('Rising');

    // traducirTextoApi() — contenido del backend, respetando la mayúscula inicial
    expect(container.querySelector('.forecast-hero-sky')).toHaveTextContent('Clear sky');
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

    // "flojo del noreste" no es una clave de tabla: se traduce partiéndolo en
    // intensidad + dirección. Antes salía en español.
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

    // La propiedad sigue siendo la misma y sigue congelada: lo desconocido pasa
    // en español, sin aviso. Los avisos de litoral son prosa libre de AEMET y no
    // están en ninguna tabla — y el partidor de viento tampoco debe tocarlos.
    expect(container.querySelector('.aviso-yellow')).toHaveTextContent(
      'Aviso amarillo por oleaje',
    );
  });
});
