import { RegionConfig } from './RegionConfig';

export const cantabria: RegionConfig = {
  id: 'cantabria',
  name: 'Cantabria',

  // ~40 km of margin: keeps out-of-region AEMET stations that are still the
  // closest useful ones for coastal edges (e.g. sunshine sensors near the
  // Asturias/Bizkaia borders).
  observationBbox: { latMin: 42.5, latMax: 43.8, lonMin: -5.2, lonMax: -2.8 },

  catalogRules: {
    // Rango geográfico razonable de Cantabria (con un pequeño margen).
    bbox: { latMin: 43.2, latMax: 43.65, lonMin: -4.9, lonMax: -3.0 },
    regionName: 'Cantabria',
    // "La Concha de Santander" no debe existir: fue un alta errónea histórica
    // (la Concha real con puesto de Cruz Roja es la de Suances).
    forbiddenBeaches: [{ municipio: 'santander', nombre: /^(la )?concha( de santander)?$/ }],
  },

  catalogPath: 'data/beaches.json',
  flagsPath: 'data/flags.json',
  flagProviders: ['cruzroja'],
};
