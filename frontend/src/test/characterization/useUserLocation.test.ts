/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `useUserLocation()`: localStorage cache valid for 5 min, the
 * distinction between "denied" (any error) and "blocked" (`code === 1`,
 * permission denied by the user) — which is what decides which of the two
 * banners shows up on the home — and the retry.
 *
 * In F2 the reading of `navigator.geolocation` and of `localStorage` moves
 * behind `core/infrastructure/geolocation`. The hook's API does not change.
 */

import { act, renderHook } from '@testing-library/react';
import { useUserLocation } from '../../hooks/useUserLocation';

const CACHE_KEY = 'user_location';
const CACHE_MAX_AGE = 5 * 60 * 1000;

type SuccessFn = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorFn = (error: { code: number }) => void;

let getCurrentPosition: jest.Mock;

/** Keeps the callbacks of the last call so the test can fire them. */
function lastCallbacks(): { success: SuccessFn; failure: ErrorFn } {
  const call = getCurrentPosition.mock.calls[getCurrentPosition.mock.calls.length - 1];
  return { success: call[0], failure: call[1] };
}

beforeEach(() => {
  localStorage.clear();
  getCurrentPosition = jest.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
});

describe('useUserLocation — caché', () => {
  it('arranca con la ubicación cacheada si es reciente y no muestra carga', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ coords: [43.4, -3.8], timestamp: Date.now() - 60_000 }),
    );

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toEqual([43.4, -3.8]);
    expect(result.current.locationLoading).toBe(false);
    // Even with a valid cache the browser is asked again to refresh it.
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('ignora una caché de más de 5 min', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ coords: [43.4, -3.8], timestamp: Date.now() - CACHE_MAX_AGE - 1 }),
    );

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
    expect(result.current.locationLoading).toBe(true);
  });

  it('ignora una caché corrupta sin romperse', () => {
    localStorage.setItem(CACHE_KEY, 'esto no es json');

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('guarda en caché la ubicación obtenida', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: { latitude: 43.46, longitude: -3.8 } });
    });

    expect(result.current.userLocation).toEqual([43.46, -3.8]);
    expect(result.current.locationLoading).toBe(false);
    expect(JSON.parse(localStorage.getItem(CACHE_KEY) as string).coords).toEqual([43.46, -3.8]);
  });
});

describe('useUserLocation — errores', () => {
  it('marca denegada Y bloqueada cuando el permiso está denegado (code 1)', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().failure({ code: 1 });
    });

    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(true);
    expect(result.current.locationLoading).toBe(false);
  });

  it('marca solo denegada con otros códigos de error', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().failure({ code: 2 });
    });

    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(false);
  });

  it('`retryLocation()` limpia el estado de error y vuelve a pedir', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().failure({ code: 1 });
    });
    expect(result.current.locationBlocked).toBe(true);

    act(() => {
      result.current.retryLocation();
    });

    expect(result.current.locationDenied).toBe(false);
    expect(result.current.locationBlocked).toBe(false);
    expect(result.current.locationLoading).toBe(true);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});

describe('useUserLocation — sin soporte de geolocalización', () => {
  it('no muestra carga si el navegador no expone geolocation', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.locationLoading).toBe(false);
    expect(result.current.userLocation).toBeNull();
  });
});

/**
 * Añadido tras un error real en el navegador: `Invalid LatLng object: (NaN, NaN)`
 * al montar MapaPage. `flyTo` recibía las coordenadas del hook sin que nadie
 * hubiera comprobado que fueran números. El mapa se cae con estrépito; la
 * ordenación por cercanía de Home y del listado se habría equivocado en silencio,
 * que es peor.
 */
describe('useUserLocation — coordenadas inservibles', () => {
  it.each([
    ['coords nulas', [null, null]],
    ['coords ausentes', undefined],
    ['un solo número', [43.4]],
    ['texto', ['43.4', '-4.05']],
    ['fuera de rango', [200, -4.05]],
    ['NaN', [NaN, NaN]],
  ])('descarta la caché con %s', (_etiqueta, coords) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ coords, timestamp: Date.now() }));

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('descarta la caché si el timestamp no es un número', () => {
    // Con un timestamp no numérico la resta da NaN y toda comparación contra él
    // es falsa: la entrada caducada colaba como si fuera fresca.
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ coords: [43.4, -4.05], timestamp: 'ayer' }),
    );

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('no acepta una lectura del navegador sin coordenadas', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: {} } as never);
    });

    expect(result.current.userLocation).toBeNull();
    expect(result.current.locationLoading).toBe(false);
    // Nadie ha denegado un permiso: no debe mandarse al usuario a los ajustes.
    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(false);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('sigue aceptando una lectura buena', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: { latitude: 43.46, longitude: -3.8 } });
    });

    expect(result.current.userLocation).toEqual([43.46, -3.8]);
    expect(result.current.locationDenied).toBe(false);
  });
});
