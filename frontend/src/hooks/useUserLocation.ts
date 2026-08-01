import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'user_location';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min

interface CachedLocation {
  coords: [number, number];
  timestamp: number;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 300_000, // 5 min
};

/**
 * The only shape this hook is willing to hand out. Anything else becomes "no
 * location", which every consumer already knows how to render.
 *
 * Both sources can yield garbage and neither is ours to trust: `localStorage`
 * is shared with everything else that ever ran on this origin, and a browser or
 * a geolocation polyfill can return a position whose coords are undefined. The
 * consequences are not symmetrical — Leaflet throws `Invalid LatLng object:
 * (NaN, NaN)` and takes the map down with it, while the distance sorting on
 * Home and the listing would just come out silently wrong, which is worse.
 */
function esCoordenadaValida(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [lat, lon] = value;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
  );
}

function getCachedLocation(): [number, number] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedLocation>;
    // Checked before comparing: with a non-numeric timestamp the subtraction
    // gives NaN, every comparison against it is false, and the stale entry
    // would sail through as if it were fresh.
    if (typeof cached?.timestamp !== 'number' || !Number.isFinite(cached.timestamp)) return null;
    if (Date.now() - cached.timestamp > CACHE_MAX_AGE) return null;
    return esCoordenadaValida(cached.coords) ? cached.coords : null;
  } catch {
    return null;
  }
}

function cacheLocation(coords: [number, number]) {
  try {
    const entry: CachedLocation = { coords, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* localStorage full or unavailable */ }
}

export interface UserLocationResult {
  userLocation: [number, number] | null;
  locationLoading: boolean;
  locationDenied: boolean;
  locationBlocked: boolean;
  retryLocation: () => void;
}

export function useUserLocation(): UserLocationResult {
  const cached = getCachedLocation();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(cached);
  const [locationLoading, setLocationLoading] = useState(!cached && !!navigator.geolocation);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);

  const requestLocation = useCallback((isRetry = false) => {
    if (!navigator.geolocation) return;

    if (isRetry) {
      setLocationDenied(false);
      setLocationBlocked(false);
      setLocationLoading(true);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos?.coords?.latitude, pos?.coords?.longitude];
        setLocationLoading(false);
        if (!esCoordenadaValida(coords)) {
          // An unusable reading is a failure, not a location. Reported as
          // "denied" but never as "blocked": nobody refused a permission here,
          // so the interface must not send the user to the browser settings.
          setLocationDenied(true);
          return;
        }
        setUserLocation(coords);
        cacheLocation(coords);
      },
      (err) => {
        setLocationLoading(false);
        setLocationDenied(true);
        if (err.code === 1) setLocationBlocked(true);
      },
      GEO_OPTIONS,
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const retryLocation = useCallback(() => {
    requestLocation(true);
  }, [requestLocation]);

  return { userLocation, locationLoading, locationDenied, locationBlocked, retryLocation };
}
