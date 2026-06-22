/**
 * Shared beach helper functions used by HomePage, PlayaDetalle, and other pages.
 */

export function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.replace(/\uFFFD/g, 'e');
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
 *  - 'color'          → bandera real izada (verde/amarilla/roja)
 *  - 'fueraDeHorario' → sin bandera y fuera del horario/temporada de vigilancia
 *  - 'sinDatos'       → sin bandera dentro del horario (aún sin captura) o sin horario conocido
 */
export function estadoBandera(
  cruzRoja?: { bandera?: string; horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null },
  ahora: Date = new Date()
): EstadoBandera {
  if (isFlagAvailable(cruzRoja)) return 'color';
  return dentroDeHorario(cruzRoja, ahora) === false ? 'fueraDeHorario' : 'sinDatos';
}

export function capitalizar(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ATTR_CONFIG: Record<string, { emoji: string; label: string }> = {
  duchas:        { emoji: '\u{1F6BF}', label: 'Duchas' },
  aseos:         { emoji: '\u{1F6BB}', label: 'Aseos' },
  parking:       { emoji: '\u{1F17F}\uFE0F', label: 'Parking' },
  accesible:     { emoji: '\u267F', label: 'Accesible' },
  chiringuito:   { emoji: '\u{1F379}', label: 'Chiringuito' },
  surf:          { emoji: '\u{1F3C4}', label: 'Surf' },
  mascotas:      { emoji: '\u{1F415}', label: 'Mascotas' },
  socorrismo:    { emoji: '\u{1F6DF}', label: 'Socorrismo' },
  nudista:       { emoji: '\u{1F3D6}\uFE0F', label: 'Nudista' },
  accesoBanista: { emoji: '\u{1F3CA}', label: 'Acceso ba\u00F1o' },
  submarinismo: { emoji: '\u{1F93F}', label: 'Submarinismo' },
};

/** Returns active attribute entries from a beach's atributos object */
export function getActiveAttrs(atributos?: Record<string, boolean | undefined> | null): Array<{ key: string; emoji: string; label: string }> {
  if (!atributos) return [];
  return Object.entries(atributos)
    .filter(([key, val]) => val === true && ATTR_CONFIG[key])
    .map(([key]) => ({ key, ...ATTR_CONFIG[key] }));
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
