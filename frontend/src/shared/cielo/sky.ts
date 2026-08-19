/**
 * Single classifier for the API's free-text sky descriptions. The vocabulary
 * is Spanish because that is the backend contract (AEMET / OpenWeather
 * phrasing, frozen for installed clients) — the regexes here match it, they
 * do not translate it (es→en stays in shared/i18n/apiText.ts, an exact-phrase
 * lookup, on purpose).
 *
 * Emoji, wording and rain detection all derive from `classifySky`, so a new
 * provider phrasing lands here once instead of in three diverging regexes
 * (the old emojiCielo / palabraCielo / esLluviaActiva trio in
 * utils/beachHelpers.ts, which now just re-exports these).
 */

export type SkyCode =
  | 'storm'
  | 'snow'
  | 'rain'
  | 'fog'
  | 'partlyCloudy'
  | 'clear'
  | 'overcast'
  | 'cloudy'
  | 'unknown';

/**
 * Evaluation order is the whole trick, and it lives ONLY here:
 *
 * - Significant weather goes FIRST. AEMET puts cloud cover and precipitation
 *   in the same string ("Cubierto con lluvia", "Intervalos nubosos con lluvia
 *   escasa"), so checking cloudiness first meant rain never showed.
 * - 'torment', not 'tormenta', so that "chubascos tormentosos" also matches.
 * - 'chubasc' without the plural: the old emoji regex required "chubascos"
 *   and a singular "Chubasco" fell through to the placeholder.
 * - Partials go BEFORE clear so the 'soleado' in "parcialmente soleado"
 *   doesn't take it.
 * - "cielo claro" is OpenWeather's clear sky (01x); AEMET says "despejado".
 * - Plain "nubes" is OpenWeather's overcast (04x); scattered ones
 *   ("nubes dispersas", "algo de nubes") already matched as partial.
 */
const SKY_PATTERNS: Array<[SkyCode, RegExp]> = [
  ['storm', /torment|el[eé]ctrica|rayos/],
  ['snow', /nieve|nevada|aguanieve/],
  ['rain', /lluvia|llovizna|chubasc/],
  ['fog', /niebla|bruma|neblina/],
  ['partlyCloudy', /poco nuboso|intervalos|parcial|nubes dispersas|algo de nubes/],
  ['clear', /despejado|soleado|claro/],
  ['overcast', /muy nuboso|cubierto|nubes/],
  ['cloudy', /nuboso|nublado/],
];

export function classifySky(text: string | null | undefined): SkyCode {
  if (!text) return 'unknown';
  const c = text.toLowerCase();
  for (const [code, pattern] of SKY_PATTERNS) {
    if (pattern.test(c)) return code;
  }
  return 'unknown';
}

/**
 * Does this sky mean it is (or may be) actively raining? Snow deliberately
 * does not count — mirrors the historical `esLluviaActiva` fallback, which
 * the rain badges rely on.
 */
export function hasPrecipitation(code: SkyCode): boolean {
  return code === 'storm' || code === 'rain';
}

export function skyEmoji(cielo: string | null, esNoche = false): string {
  // No text at night → moon; by day → the neutral placeholder.
  if (!cielo) return esNoche ? '\u{1F319}' : '⛅';

  switch (classifySky(cielo)) {
    case 'storm':
      return '⛈️';
    case 'snow':
      return '\u{1F328}️';
    case 'rain':
      return '\u{1F327}️';
    case 'fog':
      return '\u{1F32B}️';
    // At night a sun is simply wrong, and there is no widely supported
    // moon-behind-cloud emoji: clear and partly clear both become the moon.
    // Nothing is lost — `skyWord` still tells them apart in words.
    case 'partlyCloudy':
      return esNoche ? '\u{1F319}' : '\u{1F324}️';
    case 'clear':
      return esNoche ? '\u{1F319}' : '☀️';
    case 'overcast':
      return '☁️';
    case 'cloudy':
      return '⛅';
    default:
      // Unrecognized text keeps the day placeholder even at night: the text
      // said SOMETHING, we just don't know what — a moon would overclaim.
      return '⛅';
  }
}

/**
 * The app's own word for a sky, whatever the provider called it.
 *
 * The listing and the detail were describing the SAME sky with two
 * vocabularies: the ranking reason said "Sol" or "Parcialmente soleado"
 * (normalized in the backend, because AEMET and OpenWeather do not name
 * skies alike) while the detail headline printed the provider's raw string —
 * "cielo claro", "algo de nubes", "nubes dispersas". On 46 of 46 beaches the
 * two screens used different words, and both appear TOGETHER on the detail:
 * the score card with one, the headline with the other.
 *
 * Normalizing here and not in the API keeps `cielo` carrying what the
 * provider actually said — `skyEmoji` classifies on that raw text, and so
 * does the backend's scorer. This is a presentation problem, so it is fixed
 * at presentation.
 *
 * The words are Spanish UI text (product, not identifiers); English comes
 * from the caller via traducirTextoApi, as always.
 *
 * Returns null for a sky it does not recognize, so the caller shows the raw
 * text rather than dropping information.
 */
export function skyWord(
  cielo: string | null | undefined,
  esNoche = false,
): string | null {
  switch (classifySky(cielo)) {
    case 'storm':
      return 'Tormenta';
    case 'snow':
      return 'Nieve';
    case 'rain':
      return 'Lluvia';
    case 'fog':
      return 'Niebla';
    case 'partlyCloudy':
      return esNoche ? 'Parcialmente despejado' : 'Parcialmente soleado';
    // At night there is no sun to name: the same sky is "Despejado".
    case 'clear':
      return esNoche ? 'Despejado' : 'Sol';
    case 'overcast':
    case 'cloudy':
      return 'Nublado';
    default:
      return null;
  }
}
