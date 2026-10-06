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

describe('useUserLocation — cache', () => {
  it('starts with the cached location if recent and shows no loading', () => {
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

  it('ignores a cache older than 5 min', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ coords: [43.4, -3.8], timestamp: Date.now() - CACHE_MAX_AGE - 1 }),
    );

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
    expect(result.current.locationLoading).toBe(true);
  });

  it('ignores a corrupt cache without breaking', () => {
    localStorage.setItem(CACHE_KEY, 'esto no es json');

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('caches the obtained location', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: { latitude: 43.46, longitude: -3.8 } });
    });

    expect(result.current.userLocation).toEqual([43.46, -3.8]);
    expect(result.current.locationLoading).toBe(false);
    expect(JSON.parse(localStorage.getItem(CACHE_KEY) as string).coords).toEqual([43.46, -3.8]);
  });
});

describe('useUserLocation — errors', () => {
  it('flags denied AND blocked when permission is denied (code 1)', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().failure({ code: 1 });
    });

    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(true);
    expect(result.current.locationLoading).toBe(false);
  });

  it('flags only denied for other error codes', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().failure({ code: 2 });
    });

    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(false);
  });

  it('`retryLocation()` clears the error state and requests again', () => {
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

describe('useUserLocation — without geolocation support', () => {
  it('shows no loading if the browser does not expose geolocation', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.locationLoading).toBe(false);
    expect(result.current.userLocation).toBeNull();
  });
});

/**
 * Added after a real browser error: `Invalid LatLng object: (NaN, NaN)`
 * when mounting MapPage. `flyTo` received the hook's coordinates without anyone
 * having checked that they were numbers. The map crashes loudly; the
 * proximity sorting on Home and on the list would have been silently wrong,
 * which is worse.
 */
describe('useUserLocation — unusable coordinates', () => {
  it.each([
    ['coords nulas', [null, null]],
    ['coords ausentes', undefined],
    ['un solo número', [43.4]],
    ['texto', ['43.4', '-4.05']],
    ['fuera de rango', [200, -4.05]],
    ['NaN', [NaN, NaN]],
  ])('descarta la caché con %s', (_label, coords) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ coords, timestamp: Date.now() }));

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('discards the cache if the timestamp is not a number', () => {
    // With a non-numeric timestamp the subtraction yields NaN and every
    // comparison against it is false: the expired entry slipped through as fresh.
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ coords: [43.4, -4.05], timestamp: 'ayer' }),
    );

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.userLocation).toBeNull();
  });

  it('does not accept a browser reading without coordinates', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: {} } as never);
    });

    expect(result.current.userLocation).toBeNull();
    expect(result.current.locationLoading).toBe(false);
    // Nobody denied a permission: the user must not be sent to the settings.
    expect(result.current.locationDenied).toBe(true);
    expect(result.current.locationBlocked).toBe(false);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('still accepts a good reading', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => {
      lastCallbacks().success({ coords: { latitude: 43.46, longitude: -3.8 } });
    });

    expect(result.current.userLocation).toEqual([43.46, -3.8]);
    expect(result.current.locationDenied).toBe(false);
  });
});
