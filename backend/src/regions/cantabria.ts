import { RegionConfig } from './RegionConfig';

export const cantabria: RegionConfig = {
  id: 'cantabria',
  name: 'Cantabria',

  // ~40 km of margin: keeps out-of-region AEMET stations that are still the
  // closest useful ones for coastal edges (e.g. sunshine sensors near the
  // Asturias/Bizkaia borders).
  observationBbox: { latMin: 42.5, latMax: 43.8, lonMin: -5.2, lonMax: -2.8 },

  catalogRules: {
    // Reasonable geographic range for Cantabria (with a small margin).
    bbox: { latMin: 43.2, latMax: 43.65, lonMin: -4.9, lonMax: -3.0 },
    regionName: 'Cantabria',
    // "La Concha de Santander" must not exist: it was a historical bad entry
    // (the real Concha with a Cruz Roja station is the one in Suances).
    forbiddenBeaches: [{ municipio: 'santander', nombre: /^(la )?concha( de santander)?$/ }],
  },

  catalogPath: 'data/beaches.json',
  flagsPath: 'data/flags.json',
  flagProviders: ['cruzroja'],
};
