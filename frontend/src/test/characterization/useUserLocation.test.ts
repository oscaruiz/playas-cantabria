/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `useUserLocation()`: caché en localStorage con 5 min de validez, la
 * distinción entre "denegada" (cualquier error) y "bloqueada" (`code === 1`,
 * permiso denegado por el usuario) — que es lo que decide cuál de los dos
 * banners sale en la home — y el reintento.
 *
 * En F2 la lectura de `navigator.geolocation` y de `localStorage` pasa detrás de
 * `core/infrastructure/geolocation`. La API del hook no cambia.
 */

import { act, renderHook } from '@testing-library/react';
import { useUserLocation } from '../../hooks/useUserLocation';

const CACHE_KEY = 'user_location';
const CACHE_MAX_AGE = 5 * 60 * 1000;

type SuccessFn = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorFn = (error: { code: number }) => void;

let getCurrentPosition: jest.Mock;

/** Guarda los callbacks de la última llamada para dispararlos desde el test. */
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
    // Aun con caché válida se vuelve a preguntar al navegador para refrescarla.
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
