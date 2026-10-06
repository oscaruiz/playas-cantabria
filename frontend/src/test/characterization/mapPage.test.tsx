/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `MapaPage`: which beaches make it to the map and in what order, how
 * each marker's icon is decided and what is seen in the popup.
 *
 * `react-leaflet` is replaced by a double: Leaflet needs to measure the DOM and
 * does not work in jsdom. `leaflet`, on the other hand, is NOT mocked, because
 * `getBeachIcon` builds a real `L.DivIcon` and what matters is precisely the
 * HTML it generates — which today is assembled by concatenating strings (the XSS
 * surface that F4 closes by handing the marker over to React).
 *
 * The two `markerStatus` thresholds (60 and 35) are pinned down with scores
 * exactly at the cut and just below it. Careful: that 35 does NOT match the 40
 * in `ScoreBadge.tramo`. The divergence is real and is noted as a flagged F5
 * fix; here it is frozen as is.
 */

import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import type { Beach, FeaturedBeach, FeaturedBeachesResponse } from '../../services/api';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import MapPage from '../../../../../../Dev/playas-cantabria/frontend/src/pages/MapPage';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from '../apiRoutes';


const mockMap = {
  flyTo: jest.fn(),
  closePopup: jest.fn(),
  invalidateSize: jest.fn(),
};

jest.mock('react-leaflet', () => {
  const ReactMock = jest.requireActual<typeof import('react')>('react');

  return {
    MapContainer: ReactMock.forwardRef(
      (
        { children }: { children?: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        // react-leaflet hands over the map instance through a ref; the double
        // hands over `mockMapa` in an effect to respect the child→parent order.
        ReactMock.useEffect(() => {
          if (typeof ref === 'function') ref(mockMap);
          else if (ref) (ref as React.MutableRefObject<unknown>).current = mockMap;
        });
        return ReactMock.createElement('div', { 'data-testid': 'map' }, children);
      },
    ),
    TileLayer: () => null,
    Marker: ({
      position,
      icon,
      children,
    }: {
      position: [number, number];
      icon?: { options?: { html?: string } };
      children?: React.ReactNode;
    }) =>
      ReactMock.createElement(
        'div',
        {
          'data-testid': 'marker',
          'data-position': JSON.stringify(position),
          'data-icon-html': icon?.options?.html ?? '',
        },
        children,
      ),
    Popup: ({ children }: { children?: React.ReactNode }) =>
      ReactMock.createElement('div', { 'data-testid': 'popup' }, children),
  };
});

// ---- Local fixtures ------------------------------------------------------
// They are declared here (and not in test/fixtures) because they exist to nail
// down the 60/35 thresholds of `markerStatus`, which only this page uses.

const weather = {
  descripcionClima: 'cielo despejado',
  iconoClima: '11',
  motivoBaja: null,
  atributos: null,
};

function featured(
  name: string,
  code: string,
  score: number,
  extra: Partial<FeaturedBeach> = {},
): FeaturedBeach {
  return {
    ...weather,
    nombre: name,
    municipio: 'Cantabria',
    codigo: code,
    lat: 43.4,
    lon: -3.8,
    temperatura: 21,
    vientoMs: 3,
    bandera: null,
    puntuacion: score,
    razonRanking: 'cielo despejado, viento flojo',
    ...extra,
  };
}

const atCutoff = featured('EnElCorte', 'C-60', 60, {
  pronostico: { direccion: 'mejora', delta: 6, causa: 'despeja' },
});
const justBelow = featured('JustoDebajo', 'C-59', 59, { motivoBaja: 'oleaje' });
const mediumLow = featured('MedioBajo', 'C-35', 35, { motivoBaja: 'viento' });
const bad = featured('Malo', 'C-34', 34, { motivoBaja: 'bandera roja' });
const withRedFlag = featured('BanderaRoja', 'C-BR', 70, { bandera: 'Roja' });
const withStrongWind = featured('VientoFuerte', 'C-VF', 72, { vientoMs: 11.2 });
const best = featured('LaMejor', 'C-MAX', 95, { bandera: 'Verde' });

const featuredMapa: FeaturedBeachesResponse = {
  timestamp: Date.parse('2026-07-27T10:00:00.000Z'),
  playas: [best],
  revisar: [bad],
  resumenTodas: [
    atCutoff,
    justBelow,
    mediumLow,
    bad,
    withRedFlag,
    withStrongWind,
    best,
  ],
};

/** `lon` increasing the wrong way on purpose: the page must reorder from west to east. */
function beach(name: string, code: string, lon: number, extra: Partial<Beach> = {}): Beach {
  return { nombre: name, municipio: 'Cantabria', codigo: code, lat: 43.4, lon, idCruzRoja: 0, ...extra };
}

const mapBeaches: Beach[] = [
  beach('LaMejor', 'C-MAX', -3.4),
  beach('EnElCorte', 'C-60', -3.5),
  beach('JustoDebajo', 'C-59', -3.6),
  beach('MedioBajo', 'C-35', -3.7),
  beach('Malo', 'C-34', -3.8),
  beach('BanderaRoja', 'C-BR', -3.9),
  beach('VientoFuerte', 'C-VF', -4.0, {
    idCruzRoja: 42,
    webcam: { url: 'https://example.test/w', cobertura: 'exacta' },
  }),
  // Invalid coordinates: it must not make it to the map.
  beach('SinCoordenadas', 'C-NULL', 0, { lat: 0 }),
];

// ---- Helpers -------------------------------------------------------------

function markerHtml(marker: HTMLElement): string {
  return marker.getAttribute('data-icon-html') ?? '';
}

function markerByName(name: string): HTMLElement {
  const found = screen
    .getAllByTestId('marker')
    .find((m) => within(m).queryByText(name) !== null);
  if (!found) throw new Error(`No hay marcador para ${name}`);
  return found;
}

async function renderMap(route_ = '/mapa') {
  const view = renderWithProviders(<MapPage />, { route: route_ });
  await screen.findByText('LaMejor');
  return view;
}


beforeEach(() => {
  mockMap.flyTo.mockClear();
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(FEATURED, { json: featuredMapa }),
    route(BEACHES, { json: mapBeaches }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('MapaPage — qué playas se pintan', () => {
  it('descarta las de coordenadas inválidas y ordena de oeste a este', async () => {
    await renderMap();

    const names = screen
      .getAllByTestId('marker')
      .map((m) => m.querySelector('.map-popup-title')?.textContent);

    expect(names).toEqual([
      'VientoFuerte',
      'BanderaRoja',
      'Malo',
      'MedioBajo',
      'JustoDebajo',
      'EnElCorte',
      'LaMejor',
    ]);
    expect(screen.queryByText('SinCoordenadas')).not.toBeInTheDocument();
  });
});

describe('MapaPage — iconos de marcador', () => {
  it('usa los umbrales 60 y 35 para el color', async () => {
    await renderMap();

    expect(markerHtml(markerByName('EnElCorte'))).toContain('beach-marker--good');
    expect(markerHtml(markerByName('JustoDebajo'))).toContain('beach-marker--medium');
    expect(markerHtml(markerByName('MedioBajo'))).toContain('beach-marker--medium');
    expect(markerHtml(markerByName('Malo'))).toContain('beach-marker--bad');
  });

  it('destaca solo la playa de mayor puntuación', async () => {
    await renderMap();

    expect(markerHtml(markerByName('LaMejor'))).toContain('beach-marker--best');
    expect(markerHtml(markerByName('EnElCorte'))).not.toContain('beach-marker--best');
  });

  it('marca con "!" la bandera roja y el viento por encima de 8 m/s', async () => {
    await renderMap();

    expect(markerHtml(markerByName('BanderaRoja'))).toContain('beach-marker__badge');
    expect(markerHtml(markerByName('VientoFuerte'))).toContain('beach-marker__badge');
    expect(markerHtml(markerByName('EnElCorte'))).not.toContain('beach-marker__badge');
  });

  it('incluye emoji, temperatura y banderín en el HTML del icono', async () => {
    await renderMap();
    const html = markerHtml(markerByName('LaMejor'));

    expect(html).toContain('☀️');
    expect(html).toContain('21°');
    expect(html).toContain('map-pennant--green');
  });
});

describe('MapaPage — popup', () => {
  it('muestra municipio, clima y puntuación buena', async () => {
    await renderMap();
    const popup = markerByName('EnElCorte');

    expect(popup).toHaveTextContent('Municipio:');
    expect(popup.querySelector('.map-popup-status--good')).toHaveTextContent(
      'cielo despejado, viento flojo',
    );
  });

  it('muestra el motivo de bajada en las de puntuación media y baja', async () => {
    await renderMap();

    expect(
      markerByName('MedioBajo').querySelector('.map-popup-status--medium'),
    ).toHaveTextContent('viento');
    expect(markerByName('Malo').querySelector('.map-popup-status--bad')).toHaveTextContent(
      'bandera roja',
    );
  });

  it('al abrir una playa dice hacia dónde va y por qué', async () => {
    await renderMap();
    const chip = markerByName('EnElCorte').querySelector('.trend-badge');

    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('se despeja');
  });

  it('sin pronóstico el popup queda como estaba', async () => {
    await renderMap();

    expect(markerByName('Malo').querySelector('.trend-badge')).toBeNull();
  });

  it('avisa del viento fuerte en km/h', async () => {
    await renderMap();
    // 11.2 m/s * 3.6 = 40.32 → 40 km/h
    expect(markerByName('VientoFuerte')).toHaveTextContent('Viento fuerte (40 km/h)');
  });

  it('distingue vigilada de sin información según idCruzRoja', async () => {
    await renderMap();

    // The unwatched beach no longer names an operator it does not have.
    expect(markerByName('VientoFuerte')).toHaveTextContent('Vigilada por Cruz Roja');
    expect(markerByName('EnElCorte')).toHaveTextContent('No hay info de vigilancia');
  });

  it('anuncia la webcam solo donde la hay', async () => {
    await renderMap();

    expect(markerByName('VientoFuerte')).toHaveTextContent('Webcam disponible');
    expect(markerByName('EnElCorte')).not.toHaveTextContent('Webcam disponible');
  });
});

describe('MapaPage — navegación por query params', () => {
  it('vuela a las coordenadas indicadas en la URL', async () => {
    await renderMap('/mapa?lat=43.45&lon=-3.5&codigo=C-60');

    expect(mockMap.flyTo).toHaveBeenCalledWith([43.45, -3.5], 14, { duration: 0.8 });
  });

  it('no vuela si la URL no trae coordenadas', async () => {
    await renderMap('/mapa');

    expect(mockMap.flyTo).not.toHaveBeenCalled();
  });
});

describe('MapaPage — botón de localizarme', () => {
  it('pide la ubicación cuando aún no se tiene', async () => {
    const getCurrentPosition = jest.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    await renderMap();
    getCurrentPosition.mockClear();

    fireEvent.click(screen.getByLabelText('Localizarme'));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(mockMap.flyTo).not.toHaveBeenCalled();
  });

  it('centra el mapa si ya se conoce la ubicación', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: (p: unknown) => void) =>
          success({ coords: { latitude: 43.46, longitude: -3.8 } }),
      },
    });

    await renderMap();
    mockMap.flyTo.mockClear();

    fireEvent.click(screen.getByLabelText('Localizarme'));

    expect(mockMap.flyTo).toHaveBeenCalledWith([43.46, -3.8], 14, { duration: 0.8 });
  });
});
