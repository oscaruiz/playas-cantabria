import type { Playa } from '../../services/api';

/**
 * Respuesta de `GET /api/beaches`, recortada a los casos que importan.
 *
 * Cada entrada está elegida para ejercitar una rama concreta:
 *  - `laConcha`     — dos `cruzRojaStations` (el caso mayoritario: 32 de 46 playas
 *                     reales). Tiene webcam activa y alias.
 *  - `elSardinero`  — `idCruzRoja` explícito en el dato de origen (10 de 46). Sin webcam.
 *  - `laArnia`      — `sinAemet`, así que su detalle llega sin `prediccionCompleta`.
 *                     Con alias sin tilde para probar la búsqueda normalizada.
 *  - `laSalve`      — webcam `desactivada`, que debe ocultar el badge.
 *
 * OJO: esta es la forma del **DTO del backend**, que NO coincide con el JSON en
 * disco de `src/data/beaches.json`. La diferencia que importa es `idCruzRoja`:
 * el backend lo deriva del primer puesto con id (`JsonBeachRepository`), así que
 * La Concha sale por la API con `idCruzRoja: 373` — verificado con
 * `curl https://playas-cantabria.onrender.com/api/beaches` — mientras que en el
 * fichero crudo ese campo directamente no existe. Ver
 * `characterization/lifeguardedStations.test.ts`.
 */

export const laConcha: Playa = {
  nombre: 'La Concha',
  municipio: 'Suances',
  codigo: '3908503',
  lat: 43.43553526584305,
  lon: -4.0427976710155225,
  // Derivado por el backend del primer puesto con id; en el JSON crudo no existe.
  idCruzRoja: 373,
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
 * Las tres siguientes existen solo para que la búsqueda "la" devuelva 6
 * resultados y se pueda comprobar el tope de 5 sugerencias. `langre` comparte
 * código con `featuredLangre`, así que además llega con datos de clima.
 */
export const laMaruca: Playa = {
  nombre: 'La Maruca',
  municipio: 'Santander',
  codigo: '3907502',
  lat: 43.48,
  lon: -3.84,
  idCruzRoja: 0,
};

export const langre: Playa = {
  nombre: 'Langre',
  municipio: 'Ribamontán al Mar',
  codigo: '3906002',
  lat: 43.47,
  lon: -3.72,
  idCruzRoja: 0,
};

export const laredo: Playa = {
  nombre: 'Laredo',
  municipio: 'Laredo',
  codigo: '3903502',
  lat: 43.42,
  lon: -3.43,
  idCruzRoja: 310,
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
