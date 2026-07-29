import { Weather } from '../entities/Weather';
import { SunshineObservation } from '../entities/Sunshine';

/**
 * Corrige el cielo del modelo cuando la insolación OBSERVADA lo desmiente.
 *
 * El caso que lo motiva: el 29-jul, con toda la costa cubierta, OpenWeather
 * devolvía `id 800` y `clouds.all: 0` para las 46 playas y la app pintaba
 * "Sol, 26°" y ☀️. No fallaba el mapeo: fallaba la fuente. Y no valía cruzarla
 * con otro modelo, porque Open-Meteo, met.no y la previsión de playas de AEMET
 * comparten el punto ciego (una capa de estratos marinos cabe dentro de una
 * celda de su rejilla). La insolación de las estaciones es la única señal que
 * no viene de un modelo: ese día marcó 0 minutos de sol de 05:00 a 08:00 UTC.
 *
 * Módulo PURO a propósito: sin HTTP, sin caché, sin config y sin reloj propio.
 * Todo lo que decide entra por parámetro, así que las guardas se pueden probar
 * exhaustivamente sin levantar nada. Mismo patrón que `flagAggregation.ts`.
 */

/** Cielo al que se puede degradar, con su icono en la escala de OpenWeather. */
const NIVELES = {
  dispersas: { descripcion: 'nubes dispersas', icono: '03d', severidad: 2 },
  muyNuboso: { descripcion: 'muy nuboso', icono: '04d', severidad: 3 },
} as const;

export type NivelCorregido = keyof typeof NIVELES;

/**
 * Severidad del cielo que dice el modelo, en la escala de iconos de OpenWeather.
 * Solo se mapean los cielos "sin fenómeno": lluvia, tormenta, nieve y niebla se
 * quedan fuera a propósito, y al no estar en la tabla nunca se corrigen (ver
 * guarda `modelo-ya-nublado`). Un icono de lluvia debe mandar siempre.
 */
const SEVERIDAD_MODELO: Record<string, number> = {
  '01d': 0, '01n': 0, // despejado
  '02d': 1, '02n': 1, // algo de nubes
  '03d': 2, '03n': 2, // nubes dispersas
  '04d': 3, '04n': 3, // cubierto
};

/** Más allá de esto la estación ya no dice nada útil sobre esa playa. */
const MAX_KM = 40;
/** Por debajo de esto basta una estación; por encima hacen falta dos. */
const KM_SIN_CORROBORAR = 30;
/**
 * La observación de AEMET es horaria, pero `getOrSetStale` puede servir el
 * payload hasta 3 h (TTL ×6) si AEMET se cae. Sin esta guarda podríamos marcar
 * "nublado" con una observación de hace tres horas.
 */
const FRESCURA_MAX_MS = 2 * 60 * 60 * 1000;

/** Por debajo de 1/4 de hora de sol el cielo está tapado de verdad. */
const UMBRAL_MUY_NUBOSO = 0.25;
/** Por encima de 3/4 la mañana es soleada y no hay nada que corregir. */
const UMBRAL_SIN_TOCAR = 0.75;

export type MotivoDecision =
  | 'corregido'
  | 'sin-weather'
  | 'fuera-de-franja'
  | 'sin-observacion'
  | 'observacion-vieja'
  | 'estacion-lejos'
  | 'sin-segundo-testigo'
  | 'lloviendo'
  | 'modelo-ya-nublado'
  | 'sol-suficiente';

export interface ContextoCorreccion {
  /** Solo se corrige de día/tarde. Ver nota en la guarda correspondiente. */
  enFranjaDePlaya: boolean;
  ahora: number;
  /** Señal de lluvia externa (nowcast); la del propio `weather` ya se mira. */
  lloviendo?: boolean;
}

export interface DecisionCielo {
  aplicar: boolean;
  motivo: MotivoDecision;
  nivel?: NivelCorregido;
  /** Datos para el diagnóstico en modo sombra. */
  idema?: string;
  distanciaKm?: number;
  fraccion?: number;
}

/** Nivel al que degradaría esa fracción de sol, o null si no hay que tocar nada. */
function nivelPara(fraccion: number): NivelCorregido | null {
  if (fraccion < UMBRAL_MUY_NUBOSO) return 'muyNuboso';
  if (fraccion <= UMBRAL_SIN_TOCAR) return 'dispersas';
  return null;
}

function modeloDiceLluvia(weather: Weather): boolean {
  // 2xx tormenta, 3xx llovizna, 5xx lluvia, 6xx nieve en la escala de OpenWeather.
  const c = weather.conditionCode;
  if (typeof c === 'number' && c >= 200 && c < 700) return true;
  return typeof weather.precipitationMm === 'number' && weather.precipitationMm > 0;
}

/**
 * Decide SIN aplicar nada. Separado de `aplicarCorreccionCielo` para que el modo
 * sombra pueda registrar exactamente lo que habría hecho sin tocar la respuesta.
 */
export function decidirCorreccionCielo(
  weather: Weather | null,
  observaciones: readonly SunshineObservation[],
  ctx: ContextoCorreccion,
): DecisionCielo {
  if (!weather) return { aplicar: false, motivo: 'sin-weather' };

  // 1. Solo día y tarde. Además de que es lo único que le importa a la app,
  // esto elimina el peor caso límite: en la hora que contiene el amanecer la
  // insolación sale baja aunque el cielo esté impecable, simplemente porque el
  // sol estuvo bajo el horizonte parte de esa hora. Empezando a las 11:00 de
  // Madrid eso no puede pasar.
  if (!ctx.enFranjaDePlaya) return { aplicar: false, motivo: 'fuera-de-franja' };

  // Vienen ordenadas por distancia: la primera decide, el resto son testigos.
  const observacion = observaciones[0];
  if (!observacion) return { aplicar: false, motivo: 'sin-observacion' };

  const base = {
    idema: observacion.idema,
    distanciaKm: observacion.distanciaKm,
    fraccion: observacion.fraccion,
  };

  // 2. Frescura (ver FRESCURA_MAX_MS).
  if (ctx.ahora - observacion.observadoEn > FRESCURA_MAX_MS) {
    return { aplicar: false, motivo: 'observacion-vieja', ...base };
  }

  // 3. Lluvia: manda el icono de lluvia, no lo pisamos con uno de nubes.
  if (ctx.lloviendo || modeloDiceLluvia(weather)) {
    return { aplicar: false, motivo: 'lloviendo', ...base };
  }

  // 4. Distancia.
  if (observacion.distanciaKm > MAX_KM) {
    return { aplicar: false, motivo: 'estacion-lejos', ...base };
  }

  // 5. Sol suficiente: no corregimos, y tampoco "mejoramos" un cielo nublado.
  // El fallo documentado siempre va en un sentido —los modelos se comen el
  // estrato, no se inventan nubes— así que la corrección es de una dirección.
  const nivel = nivelPara(observacion.fraccion);
  if (!nivel) return { aplicar: false, motivo: 'sol-suficiente', ...base };

  // 6. Entre 30 y 40 km hace falta un segundo testigo. Una capa de estratos es
  // una banda larga y coherente a lo largo de la costa, así que si de verdad
  // está tapado habrá más de una estación viéndolo; exigir dos evita corregir
  // media provincia por un sensor sucio o averiado.
  if (observacion.distanciaKm > KM_SIN_CORROBORAR) {
    // El testigo tiene que ver AL MENOS tanta nube como la estación principal.
    // Con un simple "que no esté despejado" no bastaba: una estación con 44 de
    // los 60 minutos de sol habría validado un "muy nuboso", que es justo lo
    // contrario de lo que confirma.
    const corrobora = observaciones.some((o) => {
      if (o.idema === observacion.idema) return false;
      if (ctx.ahora - o.observadoEn > FRESCURA_MAX_MS) return false;
      const suNivel = nivelPara(o.fraccion);
      return !!suNivel && NIVELES[suNivel].severidad >= NIVELES[nivel].severidad;
    });
    if (!corrobora) return { aplicar: false, motivo: 'sin-segundo-testigo', ...base };
  }

  // 7. Solo a peor. Si el modelo ya dice algo igual o más nublado, o si dice un
  // fenómeno que no está en la tabla (lluvia, niebla, nieve), no se toca.
  const severidadModelo = weather.icon ? SEVERIDAD_MODELO[weather.icon] : undefined;
  if (severidadModelo === undefined || severidadModelo >= NIVELES[nivel].severidad) {
    return { aplicar: false, motivo: 'modelo-ya-nublado', ...base };
  }

  return { aplicar: true, motivo: 'corregido', nivel, ...base };
}

/**
 * Devuelve una copia del `Weather` con el cielo degradado. Se conservan
 * temperatura, viento, humedad y presión: solo se discute el cielo.
 *
 * `source` se mantiene INTACTO a propósito: `buildRankingReason` en BeachScorer
 * solo usa la descripción si `source === 'OpenWeather'`, así que cambiarlo aquí
 * dejaría la razón del ranking sin la parte del cielo.
 */
export function aplicarCorreccionCielo(weather: Weather, decision: DecisionCielo): Weather {
  if (!decision.aplicar || !decision.nivel) return weather;
  const nivel = NIVELES[decision.nivel];
  return { ...weather, description: nivel.descripcion, icon: nivel.icono };
}
