import type { Idioma } from './IdiomaContext';

/**
 * Day/month names and date formatting per language. Replaces the
 * DIAS_SEMANA/MESES arrays that used to live in PlayaDetalle.tsx.
 *
 * The API (AEMET) returns dates like "domingo 05" (name in Spanish)
 * or ISO "2026-04-06".
 */

const DIAS: Record<Idioma, string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MESES: Record<Idioma, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// Day name from the API (Spanish, lowercase, accents optional) → index
const INDICE_DIA_API: Record<string, number> = {
  'domingo': 0,
  'lunes': 1,
  'martes': 2,
  'miércoles': 3,
  'miercoles': 3,
  'jueves': 4,
  'viernes': 5,
  'sábado': 6,
  'sabado': 6,
};

export function nombreDia(indice: number, idioma: Idioma): string {
  return DIAS[idioma][indice] ?? '';
}

export function nombreMes(indice: number, idioma: Idioma): string {
  return MESES[idioma][indice] ?? '';
}

/** Translates the day name coming from the API ("domingo" → "Sunday"). */
export function traducirNombreDiaApi(nombre: string, idioma: Idioma): string | null {
  const indice = INDICE_DIA_API[nombre.toLowerCase().trim()];
  if (indice === undefined) return null;
  return DIAS[idioma][indice];
}

// Intl short weekday (en-US) → index into DIAS. Madrid's calendar day can
// differ from the device's, so the weekday must be read in that timezone.
const INDICE_DIA_INTL: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * TODAY as Madrid sees it, worded for a title: "jueves 21" / "Thursday 21".
 * The beach-window hours are Madrid hours, so the day they belong to must be
 * Madrid's too — a viewer in another timezone gets the beach's day, not theirs.
 */
export function todayLabelMadrid(idioma: Idioma, ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
  }).formatToParts(ahora);
  const semana = partes.find((p) => p.type === 'weekday')?.value ?? '';
  const diaMes = partes.find((p) => p.type === 'day')?.value ?? '';
  const nombre = nombreDia(INDICE_DIA_INTL[semana] ?? ahora.getDay(), idioma);
  return `${nombre} ${diaMes}`;
}

/**
 * Readable short date: es → "Domingo 5 de junio" | en → "Sunday, June 5".
 * `nombreDiaTexto` must already come in the target language and capitalized.
 */
export function formatearFechaCorta(nombreDiaTexto: string, diaMes: number, mesIndice: number, idioma: Idioma): string {
  if (idioma === 'en') {
    return `${nombreDiaTexto}, ${nombreMes(mesIndice, 'en')} ${diaMes}`;
  }
  return `${nombreDiaTexto} ${diaMes} de ${nombreMes(mesIndice, 'es')}`;
}
