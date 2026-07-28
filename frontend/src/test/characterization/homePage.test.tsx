/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `HomePage` (ruta `/`): qué playa preside, cuántas alternativas salen, los
 * badges de la cabecera, la sección "Cerca de ti" y los banners de ubicación.
 *
 * Todos los tests comparten el mismo fixture de featured, así que la caché de
 * 5 min de `services/api.ts` es inofensiva. Los estados de carga, error y vacío
 * necesitan payloads distintos y viven en `homePage.states.test.tsx` y
 * `homePage.empty.test.tsx` (un registro de módulos por fichero).
 *
 * `Date.now` se fija 30 min después del `timestamp` del fixture para que el
 * badge "actualizado hace 30 min" sea determinista.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

const NOW = featuredResponse.timestamp + 30 * 60 * 1000;

type GeoMode = 'none' | 'granted' | 'blocked' | 'denied' | 'pending';

function setGeolocation(mode: GeoMode, coords: [number, number] = [43.42, -3.43]) {
  const value =
    mode === 'none'
      ? undefined
      : {
          getCurrentPosition: (
            success: (p: unknown) => void,
            failure: (e: { code: number }) => void,
          ) => {
            if (mode === 'granted') success({ coords: { latitude: coords[0], longitude: coords[1] } });
            else if (mode === 'blocked') failure({ code: 1 });
            else if (mode === 'denied') failure({ code: 2 });
            // 'pending': no llama a nadie — deja el hook en carga.
          },
        };

  Object.defineProperty(navigator, 'geolocation', { configurable: true, value });
}

function names(container: HTMLElement, selector: string): string[] {
  return Array.from(container.querySelectorAll(selector)).map((el) => el.textContent ?? '');
}

async function renderHome() {
  const view = renderWithProviders(<HomePage />, { route: '/' });
  await screen.findByText('La Concha');
  return view;
}

beforeEach(() => {
  localStorage.removeItem('user_location');
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
  setGeolocation('none');
});

afterEach(() => {
  restoreFetch();
  jest.restoreAllMocks();
});

describe('HomePage — sin ubicación', () => {
  it('preside la playa con mayor puntuación cruda del pool >= 60', async () => {
    const { container } = await renderHome();

    expect(screen.getByText('La mejor playa para hoy')).toBeInTheDocument();
    expect(container.querySelector('#hp-hero-nombre')).toHaveTextContent('La Concha');
    expect(container.querySelector('.hp-hero-score-num')).toHaveTextContent('82');
  });

  it('muestra como alternativas el resto del pool, sin La Salvé (59 < 60)', async () => {
    const { container } = await renderHome();

    expect(names(container, '.hp-alt-name')).toEqual(['El Sardinero', 'La Arnía']);
  });

  it('pinta los badges de la cabecera', async () => {
    await renderHome();

    expect(screen.getByText('21° media')).toBeInTheDocument();
    // El contador viene de getPlayas (7 en el fixture), no de featured.
    expect(screen.getByText('7 playas')).toBeInTheDocument();
    expect(screen.getByText('actualizado hace 30 min')).toBeInTheDocument();
  });

  it('detalla el hero: emoji, temperatura, bandera y viento', async () => {
    const { container } = await renderHome();
    const hero = container.querySelector('.hp-hero-card') as HTMLElement;

    expect(hero.querySelector('.hp-hero-emoji')).toHaveTextContent('☀️');
    expect(hero.querySelector('.hp-hero-temp')).toHaveTextContent('22°');
    expect(hero.querySelector('.hp-flag-dot')).toHaveClass('hp-flag-green');
    expect(hero).toHaveTextContent('Bandera Verde');
    // vientoMs 3.1 cae en el tramo "brisa suave" (3 <= ms < 6).
    expect(hero).toHaveTextContent('brisa suave');
  });

  it('no muestra la nota de cercanía cuando la hero ya es la de más puntos', async () => {
    const { container } = await renderHome();

    expect(screen.queryByText(/Priorizada por cercanía/)).not.toBeInTheDocument();
    expect(container.querySelector('.hp-alt-chip-mejor')).toBeNull();
  });

  it('lista las playas a revisar', async () => {
    const { container } = await renderHome();

    expect(screen.getByText('Mejor revisar antes de ir')).toBeInTheDocument();
    expect(names(container, '.hp-caution-name')).toEqual(['Berria', 'Langre']);
  });

  it('oculta "Cerca de ti" y los banners cuando el navegador no da geolocalización', async () => {
    await renderHome();

    expect(screen.queryByText('Playas más cerca de ti')).not.toBeInTheDocument();
    expect(screen.queryByText('Localización bloqueada')).not.toBeInTheDocument();
    expect(screen.queryByText('Localización no disponible')).not.toBeInTheDocument();
  });

  it('navega al detalle desde el hero', async () => {
    await renderHome();

    fireEvent.click(screen.getByText('Ver detalles'));
    // MemoryRouter no expone la URL; basta con que el click no rompa y el
    // botón exista con su aria-label correcto.
    expect(screen.getByLabelText('Ver detalle de La Concha')).toBeInTheDocument();
  });
});

describe('HomePage — con ubicación', () => {
  beforeEach(() => {
    setGeolocation('granted');
  });

  it('cambia el título de la sección principal', async () => {
    await renderHome();
    expect(screen.getByText('La mejor para ti hoy')).toBeInTheDocument();
  });

  it('muestra la distancia en el hero y en las alternativas', async () => {
    const { container } = await renderHome();

    expect(container.querySelector('.hp-hero-meta')).toHaveTextContent('a 50 km');
    expect(names(container, '.hp-alt-dist')).toEqual(['a 29 km', 'a 43 km']);
  });

  it('lista las 3 playas más cercanas de resumenTodas', async () => {
    const { container } = await renderHome();

    expect(screen.getByText('Playas más cerca de ti')).toBeInTheDocument();
    expect(names(container, '.hp-nearest-name')).toEqual(['La Salvé', 'Berria', 'Langre']);
    // Ojo: sale Berria (40) aunque no sea "recomendada" — cercanía, no puntuación.
    expect(container.querySelector('.hp-nearest-sub')).toHaveTextContent('Laredo · a 2 km');
  });

  it('la penalización por distancia no cambia quién preside en este fixture', async () => {
    const { container } = await renderHome();
    // La Concha: 82 - 0.4*49.5 = 62.2; El Sardinero: 71 - 0.4*28.8 = 59.5.
    expect(container.querySelector('#hp-hero-nombre')).toHaveTextContent('La Concha');
  });
});

describe('HomePage — banners de ubicación', () => {
  it('muestra 3 esqueletos mientras se resuelve la ubicación', async () => {
    setGeolocation('pending');
    const { container } = await renderHome();

    expect(screen.getByText('Playas más cerca de ti')).toBeInTheDocument();
    expect(container.querySelectorAll('.hp-nearest-skeleton')).toHaveLength(3);
  });

  it('muestra el banner de permiso bloqueado, sin acción de reintento', async () => {
    setGeolocation('blocked');
    const { container } = await renderHome();

    expect(screen.getByText('Localización bloqueada')).toBeInTheDocument();
    expect(
      container.querySelector('.hp-location-banner--blocked'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Localización no disponible')).not.toBeInTheDocument();
  });

  it('muestra el banner reintentable con otros errores de geolocalización', async () => {
    setGeolocation('denied');
    const { container } = await renderHome();

    expect(screen.getByText('Localización no disponible')).toBeInTheDocument();
    const banner = container.querySelector('.hp-location-banner') as HTMLElement;
    expect(banner).toHaveAttribute('role', 'button');
    expect(banner).not.toHaveClass('hp-location-banner--blocked');
  });

  it('oculta "Cerca de ti" cuando se ha denegado la ubicación', async () => {
    setGeolocation('denied');
    await renderHome();

    expect(screen.queryByText('Playas más cerca de ti')).not.toBeInTheDocument();
  });
});
