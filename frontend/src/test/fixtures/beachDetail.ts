import type { PlayaDetalle, PrediccionDia } from '../../services/api';

/**
 * Fixtures for `GET /api/beaches/:codigo/details`.
 *
 * They are FACTORIES, not constants, because the detail mixes two different clocks and
 * both need to be pinned:
 *
 *  - The flag rules (`estadoBandera`, `ultimaBanderaRegistrada`) use
 *    `Intl` with `Europe/Madrid`, so they are independent of the runner's TZ.
 *    For those, absolute ISO instants are passed.
 *  - `dayTitle`, `isToday`, `getTideStatus` and `ClimaHero` use the device's
 *    LOCAL time (`getDate()`, `getHours()`). For those, the dates and
 *    tide times are derived from the local `now` the factory receives, so the
 *    test holds equally in CI (UTC) and on a laptop in Madrid.
 *
 * See `localNoon()` in `src/test/time.ts` to pin a `now` that is local
 * noon, which is what keeps the tides deterministic.
 */

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

/** AEMET HTML scraper format: "domingo 05". */
function aemetFecha(date: Date): string {
  return `${DIAS_ES[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}`;
}

function hhmm(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Surveillance schedule and season used by all factories. */
export const HORARIO = '11:00 - 20:00';
export const COBERTURA_DESDE = '15-06-2026';
export const COBERTURA_HASTA = '15-09-2026';

/**
 * Detail with a full AEMET sheet: 3 days, morning/afternoon breakdown, warnings,
 * tides and real-time observation.
 *
 * Deliberate details:
 *  - Day 0 has `manana` with all three fields set to null → `HalfDayDetail` must
 *    render with the `single` class and without the "Mañana" block.
 *  - `tiempoActual.cielo` ("cielo despejado") DIFFERS from `dias[0].tarde.cielo`
 *    ("intervalos nubosos") in order to verify that today's hero prioritizes the
 *    real observation over the forecast.
 *  - `indiceUV: 10` falls in `uv-very-high` and `nivelUV` carries the prefix the
 *    component must trim ("Índice ultravioleta Muy alto" → "Muy alto").
 *  - `temperaturaActual` (21) < `temperaturaMaxima` (26) → the "Máx." line must appear.
 */
export function buildAemetDetail(now: Date): PlayaDetalle {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // Previous tide 3 h behind and next one 2 h ahead: the next event is
  // `pleamar`, so the status must be "Subiendo" whatever the TZ.
  const bajamarPasada = hhmm(Math.max(0, nowMinutes - 180));
  const pleamarProxima = hhmm(Math.min(1439, nowMinutes + 120));

  return {
    nombre: 'La Concha',
    municipio: 'Suances',
    codigo: '3908503',
    lat: 43.43553526584305,
    lon: -4.0427976710155225,
    temperaturaActual: 21,
    atributos: {
      duchas: true,
      aseos: false,
      parking: true,
      chiringuito: true,
      accesible: true,
      socorrismo: true,
    },
    submarinismo: true,
    longitud: 1000,
    anchura: 60,
    tipoPlaya: 'Urbana',
    arena: 'Arena dorada',
    acceso: ['A pie', 'En coche'],
    parkingDescripcion: 'Más de 100 plazas',
    bus: 'Interurbano',
    hospitalDistancia: 10,
    webcam: {
      url: 'https://example.test/webcam/la-concha',
      cobertura: 'exacta',
    },
    tiempoActual: {
      cielo: 'cielo despejado',
      icono: 11,
      temperatura: 21,
      precipitacionMm: 0,
      fuente: 'OpenWeather',
      timestamp: now.toISOString(),
      lluvia: {
        estado: 'sin_lluvia',
        mm: 0,
        ultimaHora: false,
        fuentes: ['OpenWeather'],
        timestamp: now.toISOString(),
        prevista: null,
      },
    },
    cruzRoja: {
      bandera: 'Verde',
      coberturaDesde: COBERTURA_DESDE,
      coberturaHasta: COBERTURA_HASTA,
      horario: HORARIO,
      // 30 min before `now` → fresh (<24 h).
      ultimaActualizacion: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    prediccionCompleta: {
      fuente: 'AEMET_HTML',
      elaboracion: 'Elaborado el 27-07-2026 a las 10:00',
      zonaAvisos: 'Litoral de Cantabria',
      fuenteMareas: '*Puerto de Santander',
      dias: [
        {
          fecha: aemetFecha(now),
          // No morning data: forces the `single` layout.
          manana: { cielo: null, iconoCielo: null, viento: null, oleaje: null },
          tarde: {
            cielo: 'intervalos nubosos',
            iconoCielo: 13,
            viento: 'flojo del noreste',
            oleaje: 'marejadilla',
          },
          temperaturaMaxima: 26,
          sensacionTermica: 'agradable',
          temperaturaAgua: 19,
          indiceUV: 10,
          nivelUV: 'Índice ultravioleta Muy alto',
          aviso: { nivel: 3, descripcion: 'aviso amarillo por oleaje' },
        },
        {
          fecha: aemetFecha(addDays(now, 1)),
          manana: {
            cielo: 'poco nuboso',
            iconoCielo: 12,
            viento: 'moderado del oeste',
            oleaje: 'marejada',
          },
          tarde: {
            cielo: 'cielo despejado',
            iconoCielo: 11,
            viento: 'flojo variable',
            oleaje: 'rizada',
          },
          temperaturaMaxima: 28,
          sensacionTermica: 'caluroso',
          temperaturaAgua: 20,
          indiceUV: 8,
          nivelUV: 'Índice ultravioleta Muy alto',
          aviso: null,
        },
        {
          fecha: aemetFecha(addDays(now, 2)),
          manana: {
            cielo: 'muy nuboso',
            iconoCielo: 15,
            viento: 'fuerte del noroeste',
            oleaje: 'fuerte marejada',
          },
          tarde: {
            cielo: 'lluvia',
            iconoCielo: 25,
            viento: 'fuerte del noroeste',
            oleaje: 'fuerte marejada',
          },
          temperaturaMaxima: 22,
          sensacionTermica: 'fresco',
          temperaturaAgua: 18,
          indiceUV: 4,
          nivelUV: 'Índice ultravioleta Medio',
          aviso: { nivel: 2, descripcion: 'aviso naranja por lluvia' },
        },
      ],
      mareas: [
        { pleamar: [pleamarProxima], bajamar: [bajamarPasada] },
        { pleamar: ['04:12', '16:38'], bajamar: ['10:25', '22:51'] },
        { pleamar: ['05:01', '17:27'], bajamar: ['11:14', '23:40'] },
      ],
    },
  };
}

/**
 * Detail WITHOUT an AEMET sheet (`prediccionCompleta` absent): the page falls back to
 * `ClimaHero` with the `clima` data.
 *
 * `manana` is set to null because that is what the backend ALWAYS emits today
 * (`LegacyDetailsMapper.mapClima` sets `manana: null`), even though the
 * frontend type declares it required. Without `manana` the day selector
 * must not appear.
 */
export function buildOpenWeatherDetail(now: Date): PlayaDetalle {
  return {
    nombre: 'La Arnía',
    municipio: 'Piélagos',
    codigo: '3905201',
    lat: 43.49,
    lon: -3.95,
    temperaturaActual: 19,
    atributos: { mascotas: true, nudista: true },
    submarinismo: true,
    longitud: 200,
    anchura: 20,
    tipoPlaya: 'Aislada',
    arena: 'Arena y roca',
    acceso: ['A pie'],
    tiempoActual: {
      cielo: 'nubes dispersas',
      icono: 13,
      temperatura: 19,
      precipitacionMm: 0,
      fuente: 'OpenWeather',
      timestamp: now.toISOString(),
      lluvia: null,
    },
    clima: {
      fuente: 'AEMET',
      ultimaActualizacion: now.toISOString(),
      hoy: {
        summary: 'nubes dispersas',
        temperature: 19,
        waterTemperature: 18,
        sensation: 'agradable',
        wind: 'flojo',
        waves: 'rizada',
        uvIndex: 6,
        icon: '13',
      },
      // The backend always sends null here; the frontend type declares it
      // required and non-nullable, hence the cast. It is exactly the contract
      // drift that F1 fixes in `domain/beach/types.ts`.
      manana: null as unknown as PrediccionDia,
    },
  };
}

/**
 * Outside surveillance hours, with a capture from the previous day that
 * SHOULD be shown as "last registered flag" (dimmed color).
 *
 * Designed for a `now` of 2026-07-28T05:00:00Z = 07:00 in Madrid (before
 * 11:00), with the capture at 19:30 Madrid time on the 27th: within that day's
 * schedule, ~11.5 h ago (< 36 h) and within the coverage season.
 */
export function buildOutOfHoursDetail(): PlayaDetalle {
  return {
    nombre: 'El Sardinero',
    municipio: 'Santander',
    codigo: '3907501',
    lat: 43.47,
    lon: -3.78,
    cruzRoja: {
      bandera: 'Verde',
      coberturaDesde: COBERTURA_DESDE,
      coberturaHasta: COBERTURA_HASTA,
      horario: HORARIO,
      ultimaActualizacion: '2026-07-27T17:30:00.000Z', // 19:30 in Madrid
    },
  };
}

/**
 * Black flag. The backend emits it, but `flagColorClass` sends it to
 * 'unknown' and `isFlagAvailable` discards it, so today it is painted as "no
 * data" and the `bandera.negra` key does not exist.
 * See `known-issues/blackFlag.test.tsx`.
 */
export function buildBlackFlagDetail(now: Date): PlayaDetalle {
  return {
    nombre: 'Langre',
    municipio: 'Ribamontán al Mar',
    codigo: '3906002',
    lat: 43.47,
    lon: -3.72,
    cruzRoja: {
      bandera: 'Negra',
      coberturaDesde: COBERTURA_DESDE,
      coberturaHasta: COBERTURA_HASTA,
      horario: HORARIO,
      ultimaActualizacion: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    },
  };
}
