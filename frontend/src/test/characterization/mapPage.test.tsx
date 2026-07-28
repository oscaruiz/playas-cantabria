/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `MapaPage`: qué playas llegan al mapa y en qué orden, cómo se decide el
 * icono de cada marcador y qué se ve en el popup.
 *
 * `react-leaflet` se sustituye por un doble: Leaflet necesita medir el DOM y no
 * funciona en jsdom. `leaflet` en cambio NO se mockea, porque `getBeachIcon`
 * construye un `L.DivIcon` de verdad y lo interesante es justo el HTML que
 * genera — que hoy se arma concatenando cadenas (la superficie XSS que F4
 * cierra pasando el marcador a React).
 *
 * Los dos umbrales de `markerStatus` (60 y 35) se fijan con puntuaciones
 * exactamente en el corte y justo por debajo. Ojo: ese 35 NO coincide con el 40
 * de `ScoreBadge.tramo`. La divergencia es real y está anotada como arreglo
 * señalizado de F5; aquí se congela tal cual.
 */

import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import type { Playa, FeaturedBeach, FeaturedBeachesResponse } from '../../services/api';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import MapaPage from '../../pages/MapaPage';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

const mockMapa = {
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
        // react-leaflet entrega la instancia del mapa por ref; el doble entrega
        // `mockMapa` en un efecto para respetar el orden hijo→padre.
        ReactMock.useEffect(() => {
          if (typeof ref === 'function') ref(mockMapa);
          else if (ref) (ref as React.MutableRefObject<unknown>).current = mockMapa;
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

// ---- Fixtures locales ----------------------------------------------------
// Se declaran aquí (y no en test/fixtures) porque existen para clavar los
// umbrales 60/35 de `markerStatus`, que solo usa esta página.

const clima = {
  descripcionClima: 'cielo despejado',
  iconoClima: '11',
  motivoBaja: null,
  atributos: null,
};

function featured(
  nombre: string,
  codigo: string,
  puntuacion: number,
  extra: Partial<FeaturedBeach> = {},
): FeaturedBeach {
  return {
    ...clima,
    nombre,
    municipio: 'Cantabria',
    codigo,
    lat: 43.4,
    lon: -3.8,
    temperatura: 21,
    vientoMs: 3,
    bandera: null,
    puntuacion,
    razonRanking: 'cielo despejado, viento flojo',
    ...extra,
  };
}

const enElCorte = featured('EnElCorte', 'C-60', 60);
const justoDebajo = featured('JustoDebajo', 'C-59', 59, { motivoBaja: 'oleaje' });
const medioBajo = featured('MedioBajo', 'C-35', 35, { motivoBaja: 'viento' });
const malo = featured('Malo', 'C-34', 34, { motivoBaja: 'bandera roja' });
const conBanderaRoja = featured('BanderaRoja', 'C-BR', 70, { bandera: 'Roja' });
const conVientoFuerte = featured('VientoFuerte', 'C-VF', 72, { vientoMs: 11.2 });
const laMejor = featured('LaMejor', 'C-MAX', 95, { bandera: 'Verde' });

const featuredMapa: FeaturedBeachesResponse = {
  timestamp: Date.parse('2026-07-27T10:00:00.000Z'),
  playas: [laMejor],
  revisar: [malo],
  resumenTodas: [
    enElCorte,
    justoDebajo,
    medioBajo,
    malo,
    conBanderaRoja,
    conVientoFuerte,
    laMejor,
  ],
};

/** `lon` creciente al revés a propósito: la página debe reordenar de oeste a este. */
function playa(nombre: string, codigo: string, lon: number, extra: Partial<Playa> = {}): Playa {
  return { nombre, municipio: 'Cantabria', codigo, lat: 43.4, lon, idCruzRoja: 0, ...extra };
}

const playasMapa: Playa[] = [
  playa('LaMejor', 'C-MAX', -3.4),
  playa('EnElCorte', 'C-60', -3.5),
  playa('JustoDebajo', 'C-59', -3.6),
  playa('MedioBajo', 'C-35', -3.7),
  playa('Malo', 'C-34', -3.8),
  playa('BanderaRoja', 'C-BR', -3.9),
  playa('VientoFuerte', 'C-VF', -4.0, {
    idCruzRoja: 42,
    webcam: { url: 'https://example.test/w', cobertura: 'exacta' },
  }),
  // Coordenadas inválidas: no debe llegar al mapa.
  playa('SinCoordenadas', 'C-NULL', 0, { lat: 0 }),
];

// ---- Helpers -------------------------------------------------------------

function markerHtml(marker: HTMLElement): string {
  return marker.getAttribute('data-icon-html') ?? '';
}

function markerByName(nombre: string): HTMLElement {
  const found = screen
    .getAllByTestId('marker')
    .find((m) => within(m).queryByText(nombre) !== null);
  if (!found) throw new Error(`No hay marcador para ${nombre}`);
  return found;
}

async function renderMap(route_ = '/mapa') {
  const view = renderWithProviders(<MapaPage />, { route: route_ });
  await screen.findByText('LaMejor');
  return view;
}


beforeEach(() => {
  mockMapa.flyTo.mockClear();
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(FEATURED, { json: featuredMapa }),
    route(BEACHES, { json: playasMapa }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('MapaPage — qué playas se pintan', () => {
  it('descarta las de coordenadas inválidas y ordena de oeste a este', async () => {
    await renderMap();

    const nombres = screen
      .getAllByTestId('marker')
      .map((m) => m.querySelector('.mapa-popup-title')?.textContent);

    expect(nombres).toEqual([
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
    expect(html).toContain('mapa-pennant--green');
  });
});

describe('MapaPage — popup', () => {
  it('muestra municipio, clima y puntuación buena', async () => {
    await renderMap();
    const popup = markerByName('EnElCorte');

    expect(popup).toHaveTextContent('Municipio:');
    expect(popup.querySelector('.mapa-popup-status--good')).toHaveTextContent(
      'cielo despejado, viento flojo',
    );
  });

  it('muestra el motivo de bajada en las de puntuación media y baja', async () => {
    await renderMap();

    expect(
      markerByName('MedioBajo').querySelector('.mapa-popup-status--medium'),
    ).toHaveTextContent('viento');
    expect(markerByName('Malo').querySelector('.mapa-popup-status--bad')).toHaveTextContent(
      'bandera roja',
    );
  });

  it('avisa del viento fuerte en km/h', async () => {
    await renderMap();
    // 11.2 m/s * 3.6 = 40.32 → 40 km/h
    expect(markerByName('VientoFuerte')).toHaveTextContent('Viento fuerte (40 km/h)');
  });

  it('distingue vigilada de sin información según idCruzRoja', async () => {
    await renderMap();

    expect(markerByName('VientoFuerte')).toHaveTextContent('Vigilada por Cruz Roja');
    expect(markerByName('EnElCorte')).toHaveTextContent('No hay info de Cruz Roja');
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

    expect(mockMapa.flyTo).toHaveBeenCalledWith([43.45, -3.5], 14, { duration: 0.8 });
  });

  it('no vuela si la URL no trae coordenadas', async () => {
    await renderMap('/mapa');

    expect(mockMapa.flyTo).not.toHaveBeenCalled();
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
    expect(mockMapa.flyTo).not.toHaveBeenCalled();
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
    mockMapa.flyTo.mockClear();

    fireEvent.click(screen.getByLabelText('Localizarme'));

    expect(mockMapa.flyTo).toHaveBeenCalledWith([43.46, -3.8], 14, { duration: 0.8 });
  });
});
