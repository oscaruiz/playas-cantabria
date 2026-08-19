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
import { emojiCielo, palabraCielo, esLluviaActiva } from '../../utils/beachHelpers';
import { TABLAS_API } from '../i18n/apiText';

const TORMENTA = '⛈️';
const NIEVE = '\u{1F328}️';
const LLUVIA = '\u{1F327}️';
const NIEBLA = '\u{1F32B}️';
const LUNA = '\u{1F319}';
const SOL_NUBE = '\u{1F324}️';
const SOL = '☀️';
const NUBE = '☁️';
const NUBE_SOL = '⛅';

const P_SOL = 'Parcialmente soleado';
const P_DESP = 'Parcialmente despejado';

// [phrase, emoji day, emoji night, word day, word night, active rain]
const GOLDEN: Array<[string, string, string, string | null, string | null, boolean]> = [
  ['despejado', SOL, LUNA, 'Sol', 'Despejado', false],
  ['soleado', SOL, LUNA, 'Sol', 'Despejado', false],
  // Bare "sol" (a razonRanking fragment) matches no sky regex: placeholder + null.
  ['sol', NUBE_SOL, NUBE_SOL, null, null, false],
  ['parcialmente soleado', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['parcialmente despejado', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['poco nuboso', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['intervalos nubosos', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['intervalos nubosos con lluvia escasa', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['intervalos nubosos con lluvia', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['parcialmente nuboso', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['nuboso', NUBE_SOL, NUBE_SOL, 'Nublado', 'Nublado', false],
  ['nublado', NUBE_SOL, NUBE_SOL, 'Nublado', 'Nublado', false],
  ['muy nuboso', NUBE, NUBE, 'Nublado', 'Nublado', false],
  ['cubierto', NUBE, NUBE, 'Nublado', 'Nublado', false],
  ['cubierto con lluvia escasa', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['cubierto con lluvia', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['cielo nublado', NUBE_SOL, NUBE_SOL, 'Nublado', 'Nublado', false],
  ['cielo despejado', SOL, LUNA, 'Sol', 'Despejado', false],
  ['cielo cubierto', NUBE, NUBE, 'Nublado', 'Nublado', false],
  ['algo de nubes', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['nubes', NUBE, NUBE, 'Nublado', 'Nublado', false],
  ['nubes dispersas', SOL_NUBE, LUNA, P_SOL, P_DESP, false],
  ['cielo claro', SOL, LUNA, 'Sol', 'Despejado', false],
  ['lluvia', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['lluvia ligera', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['lluvia escasa', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['llovizna', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['chubascos', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['chubascos tormentosos', TORMENTA, TORMENTA, 'Tormenta', 'Tormenta', true],
  ['tormenta', TORMENTA, TORMENTA, 'Tormenta', 'Tormenta', true],
  ['niebla', NIEBLA, NIEBLA, 'Niebla', 'Niebla', false],
  ['bruma', NIEBLA, NIEBLA, 'Niebla', 'Niebla', false],
  ['neblina', NIEBLA, NIEBLA, 'Niebla', 'Niebla', false],
  ['nieve', NIEVE, NIEVE, 'Nieve', 'Nieve', false],
  // ——— beyond the inventory ———
  // AEMET capitalizes; classification must not care.
  ['Intervalos nubosos con lluvia escasa', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['Cubierto con lluvia', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  ['aguanieve', NIEVE, NIEVE, 'Nieve', 'Nieve', false],
  ['tormenta eléctrica', TORMENTA, TORMENTA, 'Tormenta', 'Tormenta', true],
  // UNIFICATION (new expectation): singular used to miss the emoji rain regex.
  ['Chubasco', LLUVIA, LLUVIA, 'Lluvia', 'Lluvia', true],
  // UNIFICATION (new expectation): storm now counts as precipitation here too.
  ['rayos', TORMENTA, TORMENTA, 'Tormenta', 'Tormenta', true],
  // Unknown text: day placeholder even at night; word null so callers show the raw text.
  ['texto que nadie reconoce', NUBE_SOL, NUBE_SOL, null, null, false],
];

describe('cielo — golden del trío emoji / palabra / lluvia activa', () => {
  it.each(GOLDEN)('"%s"', (frase, emojiDia, emojiNoche, palabraDia, palabraNoche, lluvia) => {
    expect(emojiCielo(frase, false)).toBe(emojiDia);
    expect(emojiCielo(frase, true)).toBe(emojiNoche);
    expect(palabraCielo(frase, false)).toBe(palabraDia);
    expect(palabraCielo(frase, true)).toBe(palabraNoche);
    expect(esLluviaActiva({ cielo: frase })).toBe(lluvia);
  });

  it('sin texto: luna de noche, placeholder de día, palabra null', () => {
    expect(emojiCielo(null, false)).toBe(NUBE_SOL);
    expect(emojiCielo(null, true)).toBe(LUNA);
    expect(palabraCielo(null)).toBeNull();
    expect(palabraCielo(undefined)).toBeNull();
    expect(esLluviaActiva({ cielo: null })).toBe(false);
    expect(esLluviaActiva(null)).toBe(false);
  });

  it('cada frase de MAPA_CIELO tiene fila golden', () => {
    const enTabla = new Set(GOLDEN.map(([frase]) => frase.toLowerCase()));
    for (const frase of Object.keys(TABLAS_API.MAPA_CIELO)) {
      expect(enTabla).toContain(frase);
    }
  });
});
