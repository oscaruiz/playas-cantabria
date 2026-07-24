/**
 * Shared beach helper functions used by HomePage, PlayaDetalle, and other pages.
 */

import {
  waterOutline,
  maleFemaleOutline,
  carOutline,
  accessibilityOutline,
  restaurantOutline,
  pawOutline,
  medkitOutline,
  fishOutline,
  walkOutline,
  bodyOutline,
} from 'ionicons/icons';
import type { TraducirFn } from '../i18n/IdiomaContext';
import type { ClaveTexto } from '../i18n/es';

export function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.replace(/\uFFFD/g, 'e');
}

/** Normaliza para b\u00FAsqueda: min\u00FAsculas + sin tildes (Arn\u00EDa \u2192 arnia). */
export function normalizarBusqueda(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * \u00BFLa playa coincide con el t\u00E9rmino de b\u00FAsqueda? Busca (sin distinguir tildes) en
 * nombre, municipio y alias, de modo que un nombre can\u00F3nico o un alias (top\u00F3nimo,
 * sector o nombre de puesto de Cruz Roja) encuentre la playa sin duplicar resultados.
 */
export function coincidePlaya(
  p: { nombre: string; municipio: string; alias?: string[] },
  termino: string
): boolean {
  const t = normalizarBusqueda(termino);
  if (normalizarBusqueda(p.nombre).includes(t) || normalizarBusqueda(p.municipio).includes(t)) {
    return true;
  }
  return (p.alias ?? []).some((a) => normalizarBusqueda(a).includes(t));
}

export function flagColorClass(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'red';
  if (b.includes('amarilla')) return 'yellow';
  if (b.includes('verde')) return 'green';
  return 'unknown';
}

export function isFlagAvailable(cruzRoja?: { bandera?: string }): boolean {
  if (!cruzRoja) return false;
  const b = cruzRoja.bandera?.toLowerCase() || '';
  return b.includes('roja') || b.includes('amarilla') || b.includes('verde');
}

export type EstadoBandera = 'color' | 'fueraDeHorario' | 'sinDatos';

/** Minutos transcurridos del día en la hora actual de Madrid (robusto a la TZ del dispositivo). */
function minutosAhoraMadrid(ahora: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ahora);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Fecha "YYYY-MM-DD" de Madrid hoy, para comparar con la cobertura de temporada. */
function fechaHoyMadrid(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora); // en-CA → "YYYY-MM-DD"
}

/** Convierte "DD-MM-YYYY" (formato Cruz Roja) a "YYYY-MM-DD"; null si no parsea. */
function isoDesdeDDMMYYYY(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = fecha.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Ventana de frescura: una captura de hace más de esto ya no se muestra. */
const MAX_EDAD_BANDERA_MS = 24 * 60 * 60 * 1000; // 24h — espejo de flagVigencia.ts

/**
 * ¿La captura de la bandera (ISO) es reciente (≤24h)?
 * Si el ISO no parsea, se asume fresca (lenient) para no ocultar datos buenos.
 */
export function esInfoReciente(iso: string, ahora: Date = new Date()): boolean {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return true;
  return ahora.getTime() - ms <= MAX_EDAD_BANDERA_MS;
}

/**
 * ¿Estamos dentro del horario (y temporada) de vigilancia, en hora de Madrid?
 * Devuelve null si no hay datos de horario para decidir.
 */
export function dentroDeHorario(
  cruzRoja?: { horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null },
  ahora: Date = new Date()
): boolean | null {
  if (!cruzRoja?.horario) return null;
  const m = cruzRoja.horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  // Fuera de temporada (cobertura) → no hay servicio aunque sea media tarde.
  const hoy = fechaHoyMadrid(ahora);
  const desde = isoDesdeDDMMYYYY(cruzRoja.coberturaDesde);
  const hasta = isoDesdeDDMMYYYY(cruzRoja.coberturaHasta);
  if (desde && hoy < desde) return false;
  if (hasta && hoy > hasta) return false;

  const cur = minutosAhoraMadrid(ahora);
  const ini = +m[1] * 60 + +m[2];
  const fin = +m[3] * 60 + +m[4];
  return cur >= ini && cur <= fin;
}

/**
 * Estado a mostrar para la bandera de Cruz Roja:
 *  - 'color'          → bandera real izada y vigente (verde/amarilla/roja)
 *  - 'fueraDeHorario' → fuera del horario/temporada de vigilancia
 *  - 'sinDatos'       → dentro del horario pero sin bandera fresca (sin captura
 *                       reciente o sin horario conocido)
 *
 * La bandera solo se pinta con color si es VIGENTE: dentro de horario/temporada Y
 * con dato reciente (≤24h). Un color de una captura más antigua ya no refleja lo
 * que ondea ahora → no se muestra.
 * ESPEJO del backend: misma regla en `application/mappers/flagVigencia.ts`.
 */
export function estadoBandera(
  cruzRoja?: { bandera?: string; horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null; ultimaActualizacion?: string | null },
  ahora: Date = new Date()
): EstadoBandera {
  if (dentroDeHorario(cruzRoja, ahora) === false) return 'fueraDeHorario';
  const fresca = cruzRoja?.ultimaActualizacion
    ? esInfoReciente(cruzRoja.ultimaActualizacion, ahora)
    : true;
  if (isFlagAvailable(cruzRoja) && fresca) return 'color';
  return 'sinDatos';
}

/** ¿La playa tiene una webcam mostrable? (existe y no está desactivada). */
export function webcamDisponible(
  webcam?: { estado?: 'activa' | 'desactivada' } | null
): boolean {
  return !!webcam && webcam.estado !== 'desactivada';
}

export type CoberturaWebcam = 'exacta' | 'compartida' | 'cercana';

/**
 * Clave i18n del título/etiqueta de una webcam según su cobertura. La etiqueta es
 * la señal honesta al usuario: una cámara compartida o cercana NUNCA se presenta
 * como exacta. Devuelve una `ClaveTexto` para pasarla a `t()`.
 */
export function claveCoberturaWebcam(cobertura: CoberturaWebcam): ClaveTexto {
  switch (cobertura) {
    case 'compartida':
      return 'webcam.vistaPanoramica';
    case 'cercana':
      return 'webcam.cercana';
    case 'exacta':
    default:
      return 'webcam.enDirecto';
  }
}

/**
 * "actualizado hace X" (min / horas / días) a partir de un ISO o epoch ms.
 * Devuelve '' si no parsea. Reutiliza las claves i18n `tiempo.*`.
 */
export function formatearHaceTiempo(input: string | number, t: TraducirFn): string {
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ms || Number.isNaN(ms)) return '';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return t('tiempo.ahoraMismo');
  if (min < 60) return t('tiempo.haceMin', { n: min });
  const horas = Math.floor(min / 60);
  if (horas < 24) return t('tiempo.haceHoras', { n: horas });
  return t('tiempo.haceDias', { n: Math.floor(horas / 24) });
}

export function capitalizar(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Glifo de olas para "surf" (no existe en Ionicons) \u2014 mismo formato data-URI que ionicons */
const olasIcon =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><path d='M48 192c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><path d='M48 320c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/></svg>";

export const ATTR_CONFIG: Record<string, { emoji: string; icon: string; label: string }> = {
  duchas:        { emoji: '\u{1F6BF}', icon: waterOutline, label: 'Duchas' },
  aseos:         { emoji: '\u{1F6BB}', icon: maleFemaleOutline, label: 'Aseos' },
  parking:       { emoji: '\u{1F17F}\uFE0F', icon: carOutline, label: 'Parking' },
  accesible:     { emoji: '\u267F', icon: accessibilityOutline, label: 'Accesible' },
  chiringuito:   { emoji: '\u{1F379}', icon: restaurantOutline, label: 'Chiringuito' },
  surf:          { emoji: '\u{1F3C4}', icon: olasIcon, label: 'Surf' },
  mascotas:      { emoji: '\u{1F415}', icon: pawOutline, label: 'Mascotas' },
  socorrismo:    { emoji: '\u{1F6DF}', icon: medkitOutline, label: 'Socorrismo' },
  nudista:       { emoji: '\u{1F3D6}\uFE0F', icon: bodyOutline, label: 'Nudista' },
  accesoBanista: { emoji: '\u{1F3CA}', icon: walkOutline, label: 'Acceso ba\u00F1o' },
  submarinismo: { emoji: '\u{1F93F}', icon: fishOutline, label: 'Submarinismo' },
};

/** Returns active attribute entries from a beach's atributos object */
export function getActiveAttrs(atributos?: Record<string, boolean | undefined> | null): Array<{ key: string; emoji: string; icon: string; label: string }> {
  if (!atributos) return [];
  return Object.entries(atributos)
    .filter(([key, val]) => val === true && ATTR_CONFIG[key])
    .map(([key]) => ({ key, ...ATTR_CONFIG[key] }));
}

/**
 * ¿Hay lluvia activa ahora? Prioridad: señal estructurada del backend
 * (`lluvia.estado`, multi-fuente) → mm observados → regex sobre el texto
 * del cielo (fallback para backends antiguos sin el campo).
 */
export function esLluviaActiva(
  tiempoActual?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string } | null;
  } | null
): boolean {
  if (!tiempoActual) return false;
  if (tiempoActual.lluvia?.estado === 'lloviendo') return true;
  if (tiempoActual.lluvia?.estado === 'sin_lluvia') return false;
  if ((tiempoActual.precipitacionMm ?? 0) > 0) return true;
  const c = (tiempoActual.cielo ?? '').toLowerCase();
  return /lluvia|llovizna|chubasc|tormenta/.test(c);
}

/** Hora "HH:MM" en Europe/Madrid a partir de un ISO; null si no parsea. */
export function horaLocalMadrid(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

/**
 * Lluvia PREVISTA a mostrar. Devuelve null si ya está lloviendo (el badge de
 * lluvia activa tiene prioridad — nunca dos badges a la vez) o si no hay señal.
 */
export function lluviaPrevista(
  tiempoActual?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string; prevista?: { desdeIso: string | null; mm: number | null; fuentes: string[] } | null } | null;
  } | null
): { desdeIso: string | null; mm: number | null; fuentes: string[] } | null {
  if (!tiempoActual) return null;
  if (esLluviaActiva(tiempoActual)) return null;
  return tiempoActual.lluvia?.prevista ?? null;
}

export function emojiCielo(cielo: string | null): string {
  if (!cielo) return '\u26C5';
  const c = cielo.toLowerCase();
  if (/despejado|soleado/.test(c)) return '\u2600\uFE0F';
  if (/poco nuboso|intervalos|parcial|claro/.test(c)) return '\u{1F324}\uFE0F';
  if (/muy nuboso|cubierto/.test(c)) return '\u2601\uFE0F';
  if (/nuboso|nublado/.test(c)) return '\u26C5';
  if (/tormenta|el[eé]ctrica|rayos/.test(c)) return '\u26C8\uFE0F';
  if (/lluvia|llovizna|chubascos/.test(c)) return '\u{1F327}\uFE0F';
  if (/nieve|nevada|aguanieve/.test(c)) return '\u{1F328}\uFE0F';
  if (/niebla|bruma|neblina/.test(c)) return '\u{1F32B}\uFE0F';
  return '\u26C5';
}
