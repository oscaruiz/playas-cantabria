/**
 * CHARACTERIZATION — FROZEN.
 *
 * This file used to live in `known-issues/`, pinning down two translation leaks
 * in `PlayasList`. It stays here now inverted, with the fix applied:
 *
 *  1. The distance was written by hand (`· a {km} km`) instead of using
 *     `t('comun.aKm')`, which is what HomePage and PlayaDetalle do.
 *  2. The attributes' tooltip used `ATTR_CONFIG.label`, written in raw Spanish.
 *     PlayaDetalle was already doing the right thing with `t('attr.' + key)`.
 *
 * Both languages are checked: the fix had to translate without breaking the
 * Spanish, which was what looked right before.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


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
