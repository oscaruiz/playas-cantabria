import type { FeaturedBeach, FeaturedBeachesResponse } from '../../services/api';

/**
 * Response of `GET /api/beaches/featured`.
 *
 * The scores are chosen to straddle the three cutoffs that exist in the
 * code today, which do NOT match each other:
 *   - `ScoreBadge.tramo`      → high ≥ 60, medium ≥ 40
 *   - `MapaPage.markerStatus` → good ≥ 60, medium ≥ 35
 *   - `HomePage`              → "recommended" ≥ 60
 * That is why there are beaches with 93, 71, 60, 59, 40, 38 and 34: each falls on a
 * different side of at least one of the cutoffs. See `scoreBands` in the F1 plan.
 *
 * `elSardinero` carries `vientoMs: 11.2`, above the 8 m/s threshold that
 * triggers the warning badge on the map and in the popup.
 */

const base = {
  descripcionClima: 'cielo despejado',
  iconoClima: '11',
  motivoBaja: null,
  atributos: null,
} satisfies Partial<FeaturedBeach>;

/**
 * The only one carrying the breakdown block: the rest keep the old shape on
 * purpose, so the tests also cover an installed app talking to a backend that
 * does not send it yet (the panel must still work, just without the detail).
 *
 * The six factors add up to exactly 93, which is what makes the panel
 * readable: the numbers have to explain the score they are next to. 22.4 °C
 * scores 22/25 — a very good beach temperature, not the 70% the old model gave it.
 */
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
  puntuacion: 93,
  razonRanking: 'cielo despejado, viento flojo, bandera verde, mejora en las próximas horas',
  subpuntuaciones: {
    cielo: 25, temperatura: 22, bandera: 10, viento: 25, oleaje: 6, datos: 5,
  },
  pronostico: { direccion: 'mejora', delta: 6, causa: 'despeja' },
  topeAplicado: null,
  oleaje: 'marejadilla',
  /**
   * El ejemplo aprobado de la feature: "Mejor momento: 11:00–14:00 · a partir
   * de las 17:00 aumenta el viento". En UTC porque así viaja en el API; el
   * cliente lo pinta en hora de Madrid (verano, UTC+2).
   */
  ventanaDia: {
    inicio: '2026-07-27T09:00:00.000Z',
    fin: '2026-07-27T12:00:00.000Z',
    cambio: { desde: '2026-07-27T15:00:00.000Z', causa: 'arrecia_viento' },
  },
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

/** Exactly AT the 60 cutoff: recommended, `--good` on the map, high band. */
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
  /**
   * Sin cambios en las próximas horas: en una lista no debe pintar nada. Va
   * aquí y no en La Salvé porque esa es la playa "de backend antiguo" con la
   * que se comprueba que un cliente instalado sigue funcionando sin el bloque.
   */
  pronostico: { direccion: 'estable', delta: 0, causa: null },
};

/** Just BELOW 60: outside "recommended", `--medium` on the map. */
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

/** At `ScoreBadge`'s 40 cutoff, above `MapaPage`'s 35. */
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
  motivoBaja: 'bandera roja, empeora en las próximas horas',
  pronostico: { direccion: 'empeora', delta: -5, causa: 'arrecia_viento' },
};

/** Between the two low cutoffs (35 ≤ 38 < 40): `--medium` on the map, low band on the badge. */
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
  /**
   * El caso incómodo: el cielo se abre (delta +4) pero va a llover, y la lluvia
   * manda en el pronóstico publicado. Dirección y delta se contradicen a
   * propósito — es lo que obliga al chip a callarse los puntos.
   */
  pronostico: { direccion: 'empeora', delta: 4, causa: 'lluvia_prevista' },
};

/** Below both low cutoffs: `--bad` on the map. */
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
 * Separate fixture for the "prioritized by proximity" note and the ⭐ "best
 * score" chip, which only appear when the presiding beach is NOT the one with the
 * highest raw score.
 *
 * With Cantabria's real geography that never actually happens: the distance
 * penalty is capped at 25 points (62.5 km) and the fixture's beaches are
 * too close together to open that gap. Here it is forced on purpose: `Lejana`
 * scores 90 but is ~120 km away (penalty at the cap, 65 adjusted) and `Cercana`
 * scores 70 at 0 km (70 adjusted), so `Cercana` presides even though `Lejana`
 * has more points.
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
  // Scale of each factor, sent once for the whole response.
  maximos: { cielo: 25, temperatura: 25, bandera: 10, viento: 25, oleaje: 10, datos: 5 },
};
