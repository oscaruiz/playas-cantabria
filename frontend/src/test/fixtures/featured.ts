import type { FeaturedBeach, FeaturedBeachesResponse } from '../../services/api';

/**
 * Respuesta de `GET /api/beaches/featured`.
 *
 * Las puntuaciones están elegidas a caballo de los tres cortes que hoy existen
 * en el código, que NO coinciden entre sí:
 *   - `ScoreBadge.tramo`      → alta ≥ 60, media ≥ 40
 *   - `MapaPage.markerStatus` → good ≥ 60, medium ≥ 35
 *   - `HomePage`              → "recomendada" ≥ 60
 * Por eso hay playas con 82, 71, 60, 59, 40, 38 y 34: cada una cae en un lado
 * distinto de al menos uno de los cortes. Ver `scoreBands` en el plan de F1.
 *
 * `elSardinero` lleva `vientoMs: 11.2`, por encima del umbral de 8 m/s que
 * dispara el badge de aviso en el mapa y en el popup.
 */

const base = {
  descripcionClima: 'cielo despejado',
  iconoClima: '11',
  motivoBaja: null,
  atributos: null,
} satisfies Partial<FeaturedBeach>;

export const featuredLaConcha: FeaturedBeach = {
  ...base,
  nombre: 'La Concha',
  municipio: 'Suances',
  codigo: '3908503',
  lat: 43.43553526584305,
  lon: -4.0427976710155225,
  temperatura: 22.4,
  vientoMs: 3.1,
  bandera: 'Verde',
  puntuacion: 82,
  razonRanking: 'cielo despejado, viento flojo, bandera verde',
};

export const featuredElSardinero: FeaturedBeach = {
  ...base,
  nombre: 'El Sardinero',
  municipio: 'Santander',
  codigo: '3907501',
  lat: 43.47,
  lon: -3.78,
  temperatura: 21.1,
  descripcionClima: 'nubes dispersas',
  vientoMs: 11.2,
  bandera: 'Amarilla',
  puntuacion: 71,
  razonRanking: 'nubes dispersas, viento fuerte',
};

/** Justo EN el corte de 60: recomendada, `--good` en el mapa, tramo alto. */
export const featuredLaArnia: FeaturedBeach = {
  ...base,
  nombre: 'La Arnía',
  municipio: 'Piélagos',
  codigo: '3905201',
  lat: 43.49,
  lon: -3.95,
  temperatura: 19,
  vientoMs: 5,
  bandera: null,
  puntuacion: 60,
  razonRanking: 'cielo despejado, sin datos de bandera',
};

/** Justo POR DEBAJO de 60: fuera de "recomendadas", `--medium` en el mapa. */
export const featuredLaSalve: FeaturedBeach = {
  ...base,
  nombre: 'La Salvé',
  municipio: 'Laredo',
  codigo: '3903501',
  lat: 43.41,
  lon: -3.41,
  temperatura: 20.6,
  descripcionClima: 'nubes',
  vientoMs: 6.4,
  bandera: 'Verde',
  puntuacion: 59,
  razonRanking: 'nubes, viento moderado',
};

/** En el corte de 40 de `ScoreBadge`, por encima del 35 de `MapaPage`. */
export const featuredBerria: FeaturedBeach = {
  ...base,
  nombre: 'Berria',
  municipio: 'Santoña',
  codigo: '3907001',
  lat: 43.46,
  lon: -3.46,
  temperatura: 18.2,
  descripcionClima: 'cielo nuboso',
  vientoMs: 7.9,
  bandera: 'Roja',
  puntuacion: 40,
  razonRanking: 'cielo nuboso, bandera roja',
  motivoBaja: 'bandera roja',
};

/** Entre los dos cortes bajos (35 ≤ 38 < 40): `--medium` en mapa, tramo bajo en badge. */
export const featuredSomo: FeaturedBeach = {
  ...base,
  nombre: 'Somo',
  municipio: 'Ribamontán al Mar',
  codigo: '3906001',
  lat: 43.45,
  lon: -3.75,
  temperatura: 17.5,
  descripcionClima: 'lluvia ligera',
  vientoMs: 9.5,
  bandera: 'Amarilla',
  puntuacion: 38,
  razonRanking: 'lluvia ligera, viento fuerte',
  motivoBaja: 'lluvia',
};

/** Por debajo de ambos cortes bajos: `--bad` en el mapa. */
export const featuredLangre: FeaturedBeach = {
  ...base,
  nombre: 'Langre',
  municipio: 'Ribamontán al Mar',
  codigo: '3906002',
  lat: 43.47,
  lon: -3.72,
  temperatura: 16,
  descripcionClima: 'lluvia',
  vientoMs: 12.8,
  bandera: 'Roja',
  puntuacion: 34,
  razonRanking: 'lluvia, viento muy fuerte, bandera roja',
  motivoBaja: 'lluvia y bandera roja',
};

export const resumenTodas: FeaturedBeach[] = [
  featuredLaConcha,
  featuredElSardinero,
  featuredLaArnia,
  featuredLaSalve,
  featuredBerria,
  featuredSomo,
  featuredLangre,
];

/**
 * Fixture aparte para la nota "priorizada por cercanía" y el chip ⭐ "mejor
 * puntuación", que solo aparecen cuando la playa que preside NO es la de mayor
 * puntuación cruda.
 *
 * Con la geografía real de Cantabria eso no llega a pasar: la penalización por
 * distancia está capada en 25 puntos (62,5 km) y las playas del fixture están
 * demasiado juntas para abrir esa brecha. Aquí se fuerza a propósito: `Lejana`
 * puntúa 90 pero está a ~120 km (penalización al tope, 65 ajustado) y `Cercana`
 * puntúa 70 a 0 km (70 ajustado), así que preside `Cercana` teniendo `Lejana`
 * más puntos.
 */
export const proximityCercana: FeaturedBeach = {
  ...base,
  nombre: 'Cercana',
  municipio: 'Laredo',
  codigo: 'PROX-CERCA',
  lat: 43.42,
  lon: -3.43,
  temperatura: 20,
  vientoMs: 2,
  bandera: 'Verde',
  puntuacion: 70,
  razonRanking: 'cielo despejado, viento flojo',
};

export const proximityLejana: FeaturedBeach = {
  ...base,
  nombre: 'Lejana',
  municipio: 'Muy Lejos',
  codigo: 'PROX-LEJOS',
  lat: 44.5,
  lon: -3.43,
  temperatura: 24,
  vientoMs: 2,
  bandera: 'Verde',
  puntuacion: 90,
  razonRanking: 'cielo despejado, viento flojo',
};

export const featuredProximityResponse: FeaturedBeachesResponse = {
  timestamp: Date.parse('2026-07-27T10:00:00.000Z'),
  playas: [proximityCercana, proximityLejana],
  revisar: [],
  resumenTodas: [proximityCercana, proximityLejana],
};

export const featuredResponse: FeaturedBeachesResponse = {
  timestamp: Date.parse('2026-07-27T10:00:00.000Z'),
  playas: [featuredLaConcha, featuredElSardinero, featuredLaArnia],
  revisar: [featuredBerria, featuredLangre],
  resumenTodas,
};
