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

function getCachedLocation(): [number, number] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedLocation = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_MAX_AGE) return null;
    return cached.coords;
  } catch {
    return null;
  }
}

function cacheLocation(coords: [number, number]) {
  try {
    const entry: CachedLocation = { coords, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* localStorage lleno o no disponible */ }
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
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setLocationLoading(false);
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
