/**
 * CHARACTERIZATION — FROZEN.
 *
 * This file used to live in `known-issues/`, pinning down two translation leaks
 * in `BeachList`. It stays here now inverted, with the fix applied:
 *
 *  1. The distance was written by hand (`· a {km} km`) instead of using
 *     `t('comun.aKm')`, which is what HomePage and BeachDetailPage do.
 *  2. The attributes' tooltip used `ATTR_CONFIG.label`, written in raw Spanish.
 *     BeachDetailPage was already doing the right thing with `t('attr.' + key)`.
 *
 * Both languages are checked: the fix had to translate without breaking the
 * Spanish, which was what looked right before.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import BeachList from '../../pages/BeachList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from '../apiRoutes';


function findCard(container: HTMLElement, name: string): HTMLElement {
  const card = Array.from(container.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === name,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${name}`);
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

describe('BeachList — card distance', () => {
  it('in Spanish', async () => {
    const { container } = renderWithProviders(<BeachList />, { route: '/playas' });
    await screen.findByText('La Concha');

    expect(findCard(container, 'La Concha').querySelector('.beach-card-dist')).toHaveTextContent(
      '· a 50 km',
    );
  });

  it('in English uses the same key as the rest of the app', async () => {
    const { container } = renderWithProviders(<BeachList />, {
      route: '/playas',
      language: 'en',
    });
    await screen.findByText('La Concha');

    expect(findCard(container, 'La Concha').querySelector('.beach-card-dist')).toHaveTextContent(
      '· 50 km away',
    );
  });
});

describe('BeachList — attribute tooltips', () => {
  it('in Spanish', async () => {
    const { container } = renderWithProviders(<BeachList />, { route: '/playas' });
    await screen.findByText('La Concha');

    const titles = Array.from(
      findCard(container, 'La Concha').querySelectorAll('.beach-attr-mini'),
    ).map((el) => el.getAttribute('title'));

    expect(titles).toContain('Duchas');
  });

  it('in English', async () => {
    const { container } = renderWithProviders(<BeachList />, {
      route: '/playas',
      language: 'en',
    });
    await screen.findByText('La Concha');

    const titles = Array.from(
      findCard(container, 'La Concha').querySelectorAll('.beach-attr-mini'),
    ).map((el) => el.getAttribute('title'));

    expect(titles).toContain('Showers');
    expect(titles).not.toContain('Duchas');
  });
});
