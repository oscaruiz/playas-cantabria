/**
 * CHARACTERIZATION — FROZEN.
 *
 * This file used to live in `known-issues/` with a mistaken diagnosis. What
 * remains here is the correct version, with the fix already applied.
 *
 * The defect was an INCONSISTENCY between the two data sources, not a permanent
 * absence of the badge:
 *
 *  - `src/data/beaches.json` (the local fallback) is the RAW file from the
 *    repository: 32 of the 46 beaches only carry `cruzRojaStations` and do not
 *    carry `idCruzRoja`.
 *  - The backend does derive the id from the first station
 *    (`JsonBeachRepository.mapToEntity`), so through the API those 32 arrive
 *    with `idCruzRoja > 0`. Verified against the deployed one: 42 of 46 with an
 *    id, and La Concha with `idCruzRoja: 373`.
 *
 * Since the interface only looked at `idCruzRoja`, the badge showed up with the
 * backend and was missing during the 2.5 s cold start window (and the whole
 * outage, if there was one): 32 badges appeared all at once when
 * `onBackendData` arrived.
 *
 * The fix is `vigilanciaDisponible()`, which looks at both sources. The property
 * this file pins down is the EQUIVALENCE between both paths.
 *
 * TEST ORDER MATTERS: `services/api.ts` caches 5 min in a module variable and
 * only writes on success, so the backend-down cases go BEFORE the only one that
 * responds well. It goes away in F2, once the cache is injectable.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import beachesJson from '../../data/beaches.json';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';
import { BEACH_COUNT_ES, LOCAL_CATALOG_SIZE } from '../localCatalog';


interface EntradaJson {
  nombre: string;
  idCruzRoja?: number;
  cruzRojaStations?: unknown[];
}

function badgeDe(container: HTMLElement, nombre: string): Element | null {
  const card = Array.from(container.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === nombre,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${nombre}`);
  return card.querySelector('.badge-vigilada');
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
});

it('el JSON empaquetado reparte la vigilancia entre dos campos distintos', () => {
  const playas = beachesJson as EntradaJson[];

  const conId = playas.filter((p) => (p.idCruzRoja ?? 0) > 0);
  const soloConPuestos = playas.filter(
    (p) => (p.idCruzRoja ?? 0) === 0 && (p.cruzRojaStations?.length ?? 0) > 0,
  );

  // Invariant over the output of `sync-beaches`: if the backend changed the
  // split, this test warns before it shows up in the interface.
  expect(playas).toHaveLength(LOCAL_CATALOG_SIZE);
  expect(conId).toHaveLength(10);
  expect(soloConPuestos).toHaveLength(32);
  expect(conId.length + soloConPuestos.length).toBe(42);
});

it('con el backend caído, La Concha sigue mostrando el badge', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  // The local JSON is being rendered, without `idCruzRoja` for this beach.
  await screen.findByText(BEACH_COUNT_ES);

  // This is the assertion that failed before the fix.
  expect(badgeDe(container, 'La Concha')).not.toBeNull();
});

it('las playas sin ninguna fuente de vigilancia no muestran badge', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText(BEACH_COUNT_ES);

  // Four real beaches have neither an id nor stations.
  expect(badgeDe(container, 'La Arena')).toBeNull();
  expect(badgeDe(container, 'Ostende')).toBeNull();
});

// It goes last: it is the only one that responds well and therefore the only one
// that fills the module cache of `services/api.ts` (see the header).
it('con datos del backend, La Concha muestra el badge', async () => {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  const { container } = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText('7 playas');

  // The DTO carries idCruzRoja 373 and also both stations.
  expect(badgeDe(container, 'La Concha')).not.toBeNull();
});
