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
