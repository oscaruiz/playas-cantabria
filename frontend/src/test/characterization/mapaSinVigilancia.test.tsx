/**
 * The map used to collapse two different facts into one sentence: "nobody
 * watches this beach" (`fuenteBanderas: null`, which the backend does know)
 * and "this source does not report the operator" (field absent: the offline
 * catalog and any backend older than phase 3). The list and the detail already
 * told them apart; only the popup did not.
 *
 * Its own file because `services/api.ts` caches the listing for 5 minutes in a
 * module variable: sharing a file with other listing tests would serve this one
 * somebody else's payload.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import type { Playa } from '../../services/api';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { RUTA_PLAYAS as BEACHES, RUTA_DESTACADAS as FEATURED } from '../apiRoutes';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

// Leaflet measures the DOM and does not work in jsdom; only the popup markup
// matters here.
jest.mock('react-leaflet', () => {
  const ReactMock = jest.requireActual<typeof import('react')>('react');
  return {
    MapContainer: ReactMock.forwardRef(
      ({ children }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
        ReactMock.useEffect(() => {
          if (typeof ref === 'function') {
            ref({ flyTo: jest.fn(), closePopup: jest.fn(), invalidateSize: jest.fn() });
          }
        });
        return ReactMock.createElement('div', null, children);
      },
    ),
    TileLayer: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
    Popup: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
  };
});

const sinServicio: Playa = {
  ...beachesResponse[0],
  nombre: 'Playa sin servicio',
  codigo: '9990001',
  idCruzRoja: 0,
  cruzRojaStations: undefined,
  fuenteBanderas: null,
};

const sinReportar: Playa = {
  ...beachesResponse[0],
  nombre: 'Playa de backend viejo',
  codigo: '9990002',
  lon: -3.5,
  idCruzRoja: 0,
  cruzRojaStations: undefined,
  fuenteBanderas: undefined,
};

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => restoreFetch());

it('distingue "sin servicio" de "sin información" en el popup', async () => {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: [sinServicio, sinReportar] }),
  ]);
  const MapaPage = (await import('../../pages/MapaPage')).default;
  renderWithProviders(<MapaPage />, { route: '/mapa' });
  await screen.findByText('Playa sin servicio');

  expect(screen.getByText('Sin servicio de vigilancia')).toBeInTheDocument();
  expect(screen.getByText('No hay info de vigilancia')).toBeInTheDocument();
});
