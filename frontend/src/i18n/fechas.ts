import type { Idioma } from './IdiomaContext';

/**
 * Nombres de días/meses y formato de fecha por idioma. Sustituye a los
 * arrays DIAS_SEMANA/MESES que vivían en PlayaDetalle.tsx.
 *
 * El API (AEMET) devuelve fechas como "domingo 05" (nombre en español)
 * o ISO "2026-04-06".
 */

const DIAS: Record<Idioma, string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MESES: Record<Idioma, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// Nombre de día del API (español, minúsculas, sin tildes opcionales) → índice
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

/** Traduce el nombre de día que viene del API ("domingo" → "Sunday"). */
export function traducirNombreDiaApi(nombre: string, idioma: Idioma): string | null {
  const indice = INDICE_DIA_API[nombre.toLowerCase().trim()];
  if (indice === undefined) return null;
  return DIAS[idioma][indice];
}

/**
 * Fecha corta legible: es → "Domingo 5 de junio" | en → "Sunday, June 5".
 * `nombreDiaTexto` ya debe venir en el idioma destino y capitalizado.
 */
export function formatearFechaCorta(nombreDiaTexto: string, diaMes: number, mesIndice: number, idioma: Idioma): string {
  if (idioma === 'en') {
    return `${nombreDiaTexto}, ${nombreMes(mesIndice, 'en')} ${diaMes}`;
  }
  return `${nombreDiaTexto} ${diaMes} de ${nombreMes(mesIndice, 'es')}`;
}
