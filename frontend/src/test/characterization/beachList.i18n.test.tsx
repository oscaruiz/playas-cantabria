/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Este fichero vivía en `known-issues/` fijando dos fugas de traducción de
 * `PlayasList`. Queda aquí ya invertido, con el arreglo aplicado:
 *
 *  1. La distancia se escribía a mano (`· a {km} km`) en vez de usar
 *     `t('comun.aKm')`, que es lo que hacen HomePage y PlayaDetalle.
 *  2. El tooltip de los atributos usaba `ATTR_CONFIG.label`, escrito en español
 *     a pelo. PlayaDetalle ya hacía lo correcto con `t('attr.' + key)`.
 *
 * Se comprueban los dos idiomas: el arreglo tenía que traducir sin romper el
 * español, que era lo que se veía bien antes.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

function tarjeta(container: HTMLElement, nombre: string): HTMLElement {
  const card = Array.from(container.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === nombre,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${nombre}`);
  return card;
}

beforeEach(() => {
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: (p: unknown) => void) =>
        success({ coords: { latitude: 43.42, longitude: -3.43 } }),
    },
  });
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('PlayasList — distancia de la tarjeta', () => {
  it('en español', async () => {
    const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
    await screen.findByText('La Concha');

    expect(tarjeta(container, 'La Concha').querySelector('.beach-card-dist')).toHaveTextContent(
      '· a 50 km',
    );
  });

  it('en inglés usa la misma clave que el resto de la app', async () => {
    const { container } = renderWithProviders(<PlayasList />, {
      route: '/playas',
      idioma: 'en',
    });
    await screen.findByText('La Concha');

    expect(tarjeta(container, 'La Concha').querySelector('.beach-card-dist')).toHaveTextContent(
      '· 50 km away',
    );
  });
});

describe('PlayasList — tooltips de atributos', () => {
  it('en español', async () => {
    const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
    await screen.findByText('La Concha');

    const titles = Array.from(
      tarjeta(container, 'La Concha').querySelectorAll('.beach-attr-mini'),
    ).map((el) => el.getAttribute('title'));

    expect(titles).toContain('Duchas');
  });

  it('en inglés', async () => {
    const { container } = renderWithProviders(<PlayasList />, {
      route: '/playas',
      idioma: 'en',
    });
    await screen.findByText('La Concha');

    const titles = Array.from(
      tarjeta(container, 'La Concha').querySelectorAll('.beach-attr-mini'),
    ).map((el) => el.getAttribute('title'));

    expect(titles).toContain('Showers');
    expect(titles).not.toContain('Duchas');
  });
});
