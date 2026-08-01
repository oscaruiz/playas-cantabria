import type { Playa } from '../../services/api';

/**
 * Response of `GET /api/beaches`, trimmed to the cases that matter.
 *
 * Each entry is chosen to exercise a specific branch:
 *  - `laConcha`     — two `cruzRojaStations` (the majority case: 32 of 46 real
 *                     beaches). Has an active webcam and aliases.
 *  - `elSardinero`  — explicit `idCruzRoja` in the source data (10 of 46). No webcam.
 *  - `laArnia`      — `sinAemet`, so its detail arrives without `prediccionCompleta`.
 *                     With an accent-less alias to test normalized search.
 *  - `laSalve`      — `desactivada` webcam, which must hide the badge.
 *
 * CAREFUL: this is the shape of the **backend DTO**, which does NOT match the JSON on
 * disk in `src/data/beaches.json`. The difference that matters is `idCruzRoja`:
 * the backend derives it from the first station with an id (`JsonBeachRepository`), so
 * La Concha comes out of the API with `idCruzRoja: 373` — verified with
 * `curl https://playas-cantabria.onrender.com/api/beaches` — while in the
 * raw file that field simply does not exist. See
 * `characterization/lifeguardedStations.test.ts`.
 */

export const laConcha: Playa = {
  nombre: 'La Concha',
  municipio: 'Suances',
  codigo: '3908503',
  lat: 43.43553526584305,
  lon: -4.0427976710155225,
  // Derived by the backend from the first station with an id; it does not exist in the raw JSON.
  idCruzRoja: 373,
  fuenteBanderas: 'Cruz Roja',
  cruzRojaStations: [
    { id: 373, nombreFuente: 'LA CONCHA I SUANCES' },
    { id: 820, nombreFuente: 'LA CONCHA II SUANCES' },
  ],
  atributos: {
    accesoBanista: true,
    accesible: true,
    mascotas: false,
    duchas: true,
    aseos: false,
    parking: true,
    chiringuito: true,
    socorrismo: true,
    nudista: false,
    surf: false,
  },
  longitud: 1000,
  anchura: 60,
  tipoPlaya: 'Urbana',
  arena: 'Arena dorada',
  acceso: ['A pie', 'En coche'],
  parkingDescripcion: 'Más de 100 plazas',
  bus: 'Interurbano',
  hospitalDistancia: 10,
  submarinismo: false,
  webcam: {
    url: 'https://example.test/webcam/la-concha',
    cobertura: 'exacta',
  },
};

export const elSardinero: Playa = {
  nombre: 'El Sardinero',
  municipio: 'Santander',
  codigo: '3907501',
  lat: 43.47,
  lon: -3.78,
  idCruzRoja: 101,
  fuenteBanderas: 'Cruz Roja',
  atributos: {
    accesoBanista: true,
    accesible: true,
    duchas: true,
    aseos: true,
    parking: true,
    socorrismo: true,
    surf: true,
  },
  longitud: 1500,
  anchura: 80,
  tipoPlaya: 'Urbana',
  arena: 'Arena fina',
  acceso: ['A pie', 'En autobús'],
  parkingDescripcion: 'Más de 100 plazas',
  bus: 'Urbano',
  hospitalDistancia: 3,
  submarinismo: false,
};

export const laArnia: Playa = {
  nombre: 'La Arnía',
  municipio: 'Piélagos',
  codigo: '3905201',
  lat: 43.49,
  lon: -3.95,
  idCruzRoja: 0,
  fuenteBanderas: null,
  alias: ['Arnia', 'Covachos'],
  atributos: {
    accesoBanista: false,
    accesible: false,
    mascotas: true,
    nudista: true,
  },
  longitud: 200,
  anchura: 20,
  tipoPlaya: 'Aislada',
  arena: 'Arena y roca',
  acceso: ['A pie'],
  submarinismo: true,
};

export const laSalve: Playa = {
  nombre: 'La Salvé',
  municipio: 'Laredo',
  codigo: '3903501',
  lat: 43.41,
  lon: -3.41,
  idCruzRoja: 205,
  fuenteBanderas: 'Cruz Roja',
  atributos: {
    accesoBanista: true,
    duchas: true,
    aseos: true,
    parking: true,
    chiringuito: true,
    socorrismo: true,
  },
  longitud: 4200,
  anchura: 100,
  tipoPlaya: 'Urbana',
  arena: 'Arena dorada',
  acceso: ['A pie', 'En coche'],
  bus: 'Interurbano',
  hospitalDistancia: 5,
  submarinismo: false,
  webcam: {
    url: 'https://example.test/webcam/la-salve',
    cobertura: 'compartida',
    estado: 'desactivada',
  },
};

/**
 * The next three exist only so that searching "la" returns 6
 * results and the cap of 5 suggestions can be verified. `langre` shares
 * its code with `featuredLangre`, so it also arrives with weather data.
 */
export const laMaruca: Playa = {
  nombre: 'La Maruca',
  municipio: 'Santander',
  codigo: '3907502',
  lat: 43.48,
  lon: -3.84,
  idCruzRoja: 0,
  fuenteBanderas: null,
};

export const langre: Playa = {
  nombre: 'Langre',
  municipio: 'Ribamontán al Mar',
  codigo: '3906002',
  lat: 43.47,
  lon: -3.72,
  idCruzRoja: 0,
  fuenteBanderas: null,
};

export const laredo: Playa = {
  nombre: 'Laredo',
  municipio: 'Laredo',
  codigo: '3903502',
  lat: 43.42,
  lon: -3.43,
  idCruzRoja: 310,
  fuenteBanderas: 'Cruz Roja',
};

export const beachesResponse: Playa[] = [
  laConcha,
  elSardinero,
  laArnia,
  laSalve,
  laMaruca,
  langre,
  laredo,
];
