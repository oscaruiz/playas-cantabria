import type { PlayaDetalle, PrediccionDia } from '../../services/api';

/**
 * Fixtures de `GET /api/beaches/:codigo/details`.
 *
 * Son FACTORÍAS, no constantes, porque el detalle mezcla dos relojes distintos y
 * hay que poder fijar los dos:
 *
 *  - Las reglas de bandera (`estadoBandera`, `ultimaBanderaRegistrada`) usan
 *    `Intl` con `Europe/Madrid`, así que son independientes de la TZ del runner.
 *    Para esas se pasan instantes ISO absolutos.
 *  - `dayTitle`, `isToday`, `getTideStatus` y `ClimaHero` usan la hora LOCAL del
 *    dispositivo (`getDate()`, `getHours()`). Para esas se derivan las fechas y
 *    las horas de marea del `now` local que reciba la factoría, de modo que el
 *    test valga igual en CI (UTC) que en un portátil en Madrid.
 *
 * Ver `localNoon()` en `src/test/time.ts` para fijar un `now` que sea mediodía
 * local, que es lo que mantiene deterministas las mareas.
 */

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

/** Formato del scraper HTML de AEMET: "domingo 05". */
function aemetFecha(date: Date): string {
  return `${DIAS_ES[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}`;
}

function hhmm(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Horario y temporada de vigilancia usados por todas las factorías. */
export const HORARIO = '11:00 - 20:00';
export const COBERTURA_DESDE = '15-06-2026';
export const COBERTURA_HASTA = '15-09-2026';

/**
 * Detalle con ficha AEMET completa: 3 días, desglose mañana/tarde, avisos,
 * mareas y observación en tiempo real.
 *
 * Detalles deliberados:
 *  - El día 0 tiene `manana` con los tres campos a null → `HalfDayDetail` debe
 *    renderizarse con la clase `single` y sin el bloque "Mañana".
 *  - `tiempoActual.cielo` ("cielo despejado") DIFIERE de `dias[0].tarde.cielo`
 *    ("intervalos nubosos") para poder comprobar que el hero de hoy prioriza la
 *    observación real sobre la previsión.
 *  - `indiceUV: 10` cae en `uv-very-high` y `nivelUV` lleva el prefijo que el
 *    componente debe recortar ("Índice ultravioleta Muy alto" → "Muy alto").
 *  - `temperaturaActual` (21) < `temperaturaMaxima` (26) → debe salir la línea "Máx.".
 */
export function buildAemetDetail(now: Date): PlayaDetalle {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // Marea anterior 3 h atrás y siguiente 2 h por delante: el próximo evento es
  // pleamar, así que el estado debe ser "Subiendo" sea cual sea la TZ.
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
      // 30 min antes de `now` → fresca (<24 h).
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
          // Sin datos de mañana: fuerza el layout `single`.
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
 * Detalle SIN ficha AEMET (`prediccionCompleta` ausente): la página cae a
 * `ClimaHero` con los datos de `clima`.
 *
 * `manana` va a null porque es lo que el backend emite SIEMPRE hoy
 * (`LegacyDetailsMapper.mapClima` fija `manana: null`), aunque el tipo del
 * frontend lo declare obligatorio. Sin `manana` no debe aparecer el selector
 * de días.
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
      // El backend siempre manda null aquí; el tipo del frontend lo declara
      // obligatorio y no nulable, de ahí el cast. Es exactamente la deriva de
      // contrato que F1 corrige en `domain/beach/types.ts`.
      manana: null as unknown as PrediccionDia,
    },
  };
}

/**
 * Fuera del horario de vigilancia, con una captura de la jornada anterior que
 * SÍ debe mostrarse como "última bandera registrada" (color atenuado).
 *
 * Pensado para un `now` de 2026-07-28T05:00:00Z = 07:00 en Madrid (antes de las
 * 11:00), con la captura a las 19:30 de Madrid del día 27: dentro del horario de
 * esa jornada, hace ~11,5 h (< 36 h) y dentro de la temporada de cobertura.
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
      ultimaActualizacion: '2026-07-27T17:30:00.000Z', // 19:30 en Madrid
    },
  };
}

/**
 * Bandera negra. El backend la emite, pero `flagColorClass` la manda a
 * 'unknown' e `isFlagAvailable` la descarta, así que hoy se pinta como "sin
 * datos" y no existe la clave `bandera.negra`.
 * Ver `known-issues/blackFlag.test.tsx`.
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
