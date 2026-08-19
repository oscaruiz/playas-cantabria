import { describe, it, expect } from 'vitest';
import { findTideReference } from '../domain/services/tideReference';
import type { Beach } from '../domain/entities/Beach';

// Real-ish Cantabria coordinates: Langre has no AEMET sheet; Somo (its
// municipality neighbour) and Sardinero (farther, in Santander) both have one.
const LANGRE: Beach = {
  id: 'langre',
  name: 'Langre',
  municipality: 'Ribamontán al Mar',
  aemetCode: 'langre',
  sinAemet: true,
  latitude: 43.462,
  longitude: -3.73,
};

const SOMO: Beach = {
  id: 'somo',
  name: 'Somo',
  municipality: 'Ribamontán al Mar',
  aemetCode: 'somo',
  latitude: 43.4584,
  longitude: -3.7352,
};

const SARDINERO: Beach = {
  id: 'sardinero',
  name: 'El Sardinero',
  municipality: 'Santander',
  aemetCode: 'sardinero',
  latitude: 43.4771,
  longitude: -3.7871,
};

const OTHER_NO_AEMET: Beach = {
  id: 'otra-sin-ficha',
  name: 'Otra sin ficha',
  municipality: 'Ribamontán al Mar',
  aemetCode: 'otra-sin-ficha',
  sinAemet: true,
  latitude: 43.463,
  longitude: -3.729,
};

describe('findTideReference', () => {
  it('elige la playa con ficha AEMET más cercana, no la más cercana a secas', () => {
    const result = findTideReference(LANGRE, [SOMO, SARDINERO, OTHER_NO_AEMET]);
    expect(result?.beach.name).toBe('Somo');
    expect(result?.distanceKm).toBeGreaterThan(0);
    expect(result?.distanceKm).toBeLessThan(10);
  });

  it('ignora candidatas sinAemet, aunque estén más cerca', () => {
    // OTHER_NO_AEMET is geographically closer to LANGRE than SOMO, but has no sheet.
    const result = findTideReference(LANGRE, [OTHER_NO_AEMET, SOMO]);
    expect(result?.beach.name).toBe('Somo');
  });

  it('se excluye a sí misma como candidata', () => {
    const self: Beach = { ...SOMO };
    const result = findTideReference(SOMO, [self, SARDINERO]);
    expect(result?.beach.name).toBe('El Sardinero');
  });

  it('devuelve null si no hay ninguna candidata con ficha', () => {
    const result = findTideReference(LANGRE, [OTHER_NO_AEMET]);
    expect(result).toBeNull();
  });

  it('devuelve null si no hay candidatas en absoluto', () => {
    expect(findTideReference(LANGRE, [])).toBeNull();
  });

  it('respeta el techo maxKm, por si algún día hace falta acotar', () => {
    const farAway: Beach = { ...SARDINERO, id: 'lejos', latitude: 44.5, longitude: -2.0 };
    expect(findTideReference(LANGRE, [farAway], 5)).toBeNull();
    expect(findTideReference(LANGRE, [farAway], 500)).not.toBeNull();
  });
});
