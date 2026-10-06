import type { Language } from './IdiomaContext';

/**
 * Day/month names and date formatting per language. Replaces the
 * DIAS_SEMANA/MESES arrays that used to live in PlayaDetalle.tsx.
 *
 * The API (AEMET) returns dates like "domingo 05" (name in Spanish)
 * or ISO "2026-04-06".
 */

const DAYS: Record<Language, string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MONTHS: Record<Language, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// Day name from the API (Spanish, lowercase, accents optional) → index
const API_DAY_INDEX: Record<string, number> = {
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

export function dayName(index: number, language: Language): string {
  return DAYS[language][index] ?? '';
}

export function monthName(index: number, language: Language): string {
  return MONTHS[language][index] ?? '';
}

/** Translates the day name coming from the API ("domingo" → "Sunday"). */
export function translateApiDayName(name: string, language: Language): string | null {
  const index = API_DAY_INDEX[name.toLowerCase().trim()];
  if (index === undefined) return null;
  return DAYS[language][index];
}

// Intl short weekday (en-US) → index into DIAS. Madrid's calendar day can
// differ from the device's, so the weekday must be read in that timezone.
const INTL_DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * TODAY as Madrid sees it, worded for a title: "jueves 21" / "Thursday 21".
 * The beach-window hours are Madrid hours, so the day they belong to must be
 * Madrid's too — a viewer in another timezone gets the beach's day, not theirs.
 */
export function todayLabelMadrid(language: Language, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
  }).formatToParts(now);
  const week = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const dayOfMonth = parts.find((p) => p.type === 'day')?.value ?? '';
  const name = dayName(INTL_DAY_INDEX[week] ?? now.getDay(), language);
  return `${name} ${dayOfMonth}`;
}

/**
 * Readable short date: es → "Domingo 5 de junio" | en → "Sunday, June 5".
 * `nombreDiaTexto` must already come in the target language and capitalized.
 */
export function formatShortDate(dayNameText: string, dayOfMonth: number, monthIndex: number, language: Language): string {
  if (language === 'en') {
    return `${dayNameText}, ${monthName(monthIndex, 'en')} ${dayOfMonth}`;
  }
  return `${dayNameText} ${dayOfMonth} de ${monthName(monthIndex, 'es')}`;
}
