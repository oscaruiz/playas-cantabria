/**
 * CHARACTERIZATION — FROZEN.
 *
 * The local data notice of `BeachList`. It replaces the error state that
 * existed before and that was unreachable: `getBeaches` never rejects, so with
 * the backend down the user saw the full listing without any hint that it
 * was a build-time copy.
 *
 * Each test advances the clock by more than 5 min so that the module cache of
 * `services/api.ts` does not prevent exercising the declared HTTP route.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import BeachList from '../../pages/BeachList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from '../apiRoutes';
import { BEACH_COUNT_ES, BEACH_COUNT_EN } from '../localCatalog';


const WARNING = 'Sin conexión: mostrando datos guardados, puede que estén desactualizados';
let now = Date.now();

beforeEach(() => {
  now += 5 * 60 * 1000 + 1;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.restoreAllMocks();
});

it('notifies when the backend is down, and keeps showing the listing', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  renderWithProviders(<BeachList />, { route: '/playas' });

  await screen.findByText(BEACH_COUNT_ES);
  const warning = screen.getByText(WARNING);
  expect(warning).toBeInTheDocument();
  // `role="status"` so that screen readers announce it without stealing focus.
  expect(warning.closest('[role="status"]')).not.toBeNull();
});

it('the notice is translated', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  renderWithProviders(<BeachList />, { route: '/playas', language: 'en' });

  await screen.findByText(BEACH_COUNT_EN);
  expect(
    screen.getByText('Offline: showing saved data, it may be out of date'),
  ).toBeInTheDocument();
});

it('the notice disappears if the backend ends up responding', async () => {
  const late = deferred<RouteSpec>();
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, () => late.promise),
  ]);

  renderWithProviders(<BeachList />, { route: '/playas' });

  // After the default 2.5 s the local JSON is served and the notice shows up.
  await screen.findByText(BEACH_COUNT_ES, undefined, { timeout: 4000 });
  expect(screen.getByText(WARNING)).toBeInTheDocument();

  // And when the backend finally answers, both data and notice are replaced.
  late.resolve({ json: beachesResponse });

  await waitFor(() => expect(screen.getByText('7 playas')).toBeInTheDocument());
  expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
}, 10000);

it('does not notify when the backend responds in time', async () => {
  const fetchMock = installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  renderWithProviders(<BeachList />, { route: '/playas' });

  await screen.findByText('7 playas');
  expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  expect(
    fetchMock.mock.calls.filter(([url]) => BEACHES.test(String(url))),
  ).toHaveLength(1);
});
