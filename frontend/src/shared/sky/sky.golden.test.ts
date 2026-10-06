/**
 * GOLDEN — pins the sky classification trio (emoji, word, active-rain
 * fallback) over the full known phrase inventory, day and night.
 *
 * Written BEFORE extracting `shared/cielo/sky.ts` and kept after: the same
 * table must hold when `beachHelpers` merely re-exports the new module. The
 * inventory is `TABLAS_API.MAPA_CIELO` (the es→en table is the project's
 * real catalog of provider phrasings) plus edge cases; a coverage assertion
 * forces every future MAPA_CIELO phrase to get a golden row here.
 *
 * Two rows pin DELIBERATE unification changes (see plan/commit):
 *  - "Chubasco" (singular): emoji was ⛅ (old regex required the plural),
 *    now 🌧️ — the `chubasc` stem of palabraCielo wins everywhere.
 *  - "rayos": active rain was false (old fallback only knew 'tormenta'),
 *    now true — storm counts as precipitation, as it already did for emoji.
 */
import { skyEmoji, skyWord, isRainActive } from '../../../../../../Dev/playas-cantabria/frontend/src/utils/beachHelpers';
import { API_TABLES } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/apiText';

const STORM = '⛈️';
const SNOW = '\u{1F328}️';
const RAIN = '\u{1F327}️';
const FOG = '\u{1F32B}️';
const MOON = '\u{1F319}';
const SUN_CLOUD = '\u{1F324}️';
const SUN = '☀️';
const CLOUD = '☁️';
const CLOUD_SUN = '⛅';

const P_SUN = 'Parcialmente soleado';
const P_AFTER = 'Parcialmente despejado';

// [phrase, emoji day, emoji night, word day, word night, active rain]
const GOLDEN: Array<[string, string, string, string | null, string | null, boolean]> = [
  ['despejado', SUN, MOON, 'Sol', 'Despejado', false],
  ['soleado', SUN, MOON, 'Sol', 'Despejado', false],
  // Bare "sol" (a razonRanking fragment) matches no sky regex: placeholder + null.
  ['sol', CLOUD_SUN, CLOUD_SUN, null, null, false],
  ['parcialmente soleado', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['parcialmente despejado', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['poco nuboso', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['intervalos nubosos', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['intervalos nubosos con lluvia escasa', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['intervalos nubosos con lluvia', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['parcialmente nuboso', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['nuboso', CLOUD_SUN, CLOUD_SUN, 'Nublado', 'Nublado', false],
  ['nublado', CLOUD_SUN, CLOUD_SUN, 'Nublado', 'Nublado', false],
  ['muy nuboso', CLOUD, CLOUD, 'Nublado', 'Nublado', false],
  ['cubierto', CLOUD, CLOUD, 'Nublado', 'Nublado', false],
  ['cubierto con lluvia escasa', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['cubierto con lluvia', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['cielo nublado', CLOUD_SUN, CLOUD_SUN, 'Nublado', 'Nublado', false],
  ['cielo despejado', SUN, MOON, 'Sol', 'Despejado', false],
  ['cielo cubierto', CLOUD, CLOUD, 'Nublado', 'Nublado', false],
  ['algo de nubes', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['nubes', CLOUD, CLOUD, 'Nublado', 'Nublado', false],
  ['nubes dispersas', SUN_CLOUD, MOON, P_SUN, P_AFTER, false],
  ['cielo claro', SUN, MOON, 'Sol', 'Despejado', false],
  ['lluvia', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['lluvia ligera', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['lluvia escasa', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['llovizna', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['chubascos', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['chubascos tormentosos', STORM, STORM, 'Tormenta', 'Tormenta', true],
  ['tormenta', STORM, STORM, 'Tormenta', 'Tormenta', true],
  ['niebla', FOG, FOG, 'Niebla', 'Niebla', false],
  ['bruma', FOG, FOG, 'Niebla', 'Niebla', false],
  ['neblina', FOG, FOG, 'Niebla', 'Niebla', false],
  ['nieve', SNOW, SNOW, 'Nieve', 'Nieve', false],
  // ——— beyond the inventory ———
  // AEMET capitalizes; classification must not care.
  ['Intervalos nubosos con lluvia escasa', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['Cubierto con lluvia', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  ['aguanieve', SNOW, SNOW, 'Nieve', 'Nieve', false],
  ['tormenta eléctrica', STORM, STORM, 'Tormenta', 'Tormenta', true],
  // UNIFICATION (new expectation): singular used to miss the emoji rain regex.
  ['Chubasco', RAIN, RAIN, 'Lluvia', 'Lluvia', true],
  // UNIFICATION (new expectation): storm now counts as precipitation here too.
  ['rayos', STORM, STORM, 'Tormenta', 'Tormenta', true],
  // Unknown text: day placeholder even at night; word null so callers show the raw text.
  ['texto que nadie reconoce', CLOUD_SUN, CLOUD_SUN, null, null, false],
];

describe('cielo — golden del trío emoji / palabra / lluvia activa', () => {
  it.each(GOLDEN)('"%s"', (phrase, dayEmoji, nightEmoji, dayWord, nightWord, rain) => {
    expect(skyEmoji(phrase, false)).toBe(dayEmoji);
    expect(skyEmoji(phrase, true)).toBe(nightEmoji);
    expect(skyWord(phrase, false)).toBe(dayWord);
    expect(skyWord(phrase, true)).toBe(nightWord);
    expect(isRainActive({ cielo: phrase })).toBe(rain);
  });

  it('sin texto: luna de noche, placeholder de día, palabra null', () => {
    expect(skyEmoji(null, false)).toBe(CLOUD_SUN);
    expect(skyEmoji(null, true)).toBe(MOON);
    expect(skyWord(null)).toBeNull();
    expect(skyWord(undefined)).toBeNull();
    expect(isRainActive({ cielo: null })).toBe(false);
    expect(isRainActive(null)).toBe(false);
  });

  it('cada frase de MAPA_CIELO tiene fila golden', () => {
    const inTable = new Set(GOLDEN.map(([phrase]) => phrase.toLowerCase()));
    for (const phrase of Object.keys(API_TABLES.MAPA_CIELO)) {
      expect(inTable).toContain(phrase);
    }
  });
});
