import { cardSummary } from './domain/cardSummary';
import { cardFileName } from './infrastructure/shareImage';
import { es } from '../../shared/i18n/es';
import { en } from '../../shared/i18n/en';
import type { TextKey } from '../../shared/i18n/es';
import type { Language } from '../../shared/i18n/LanguageContext';
import type { FeaturedBeach } from '../../services/api';

/** `t` without the provider: the card is built from data, not from a tree. */
const translator = (language: Language) => (key: TextKey) =>
  (language === 'en' ? en : es)[key] ?? key;

const NOW_ISO = new Date(2026, 7, 5); // 5 August 2026, a Wednesday

const SCORED: FeaturedBeach = {
  nombre: 'La Maruca',
  municipio: 'Santander',
  codigo: '3907501',
  lat: 43.48,
  lon: -3.83,
  temperatura: 20,
  descripcionClima: 'Nublado',
  iconoClima: '04d',
  vientoMs: 1.2,
  bandera: 'Verde',
  puntuacion: 66.4,
  razonRanking: 'Nublado, 20º, sin viento',
  motivoBaja: null,
  atributos: null,
  oleaje: 'Débil',
};

const input = (language: Language, scored: FeaturedBeach = SCORED) => ({
  beach: { nombre: 'La Maruca', municipio: 'Santander' },
  scored,
  brand: 'Playucas.es',
  site: 'playucas.es',
  now: NOW_ISO,
  t: translator(language),
  language,
});

describe('shareable card summary', () => {
  it('says the same as the sheet: rounded score, summary and the three cells', () => {
    const r = cardSummary(input('es'));

    expect(r.name).toBe('La Maruca');
    expect(r.context).toBe('Santander · Miércoles 5 de agosto');
    // 66.4 is rounded: the image cannot show decimals the sheet does not show.
    expect(r.score).toBe(66);
    expect(r.summary).toBe('Nublado, 20º, sin viento');
    expect(r.cells.map((c) => c.value)).toEqual(['Sin viento', 'Débil', 'Verde']);
    expect(r.cells[2].flag).toBe('green');
  });

  it('translates to English everything that is painted, also what comes from the backend', () => {
    const r = cardSummary(input('en'));

    expect(r.context).toBe('Santander · Wednesday, August 5');
    expect(r.cells.map((c) => c.label)).toEqual(['Wind', 'Waves', 'Flag']);
    expect(r.cells[1].value).toBe('Light');
    expect(r.cells[2].value).toBe('Green');
    expect(r.warning).toBe(en['aviso.ranking']);
  });

  // A cell saying "sin bandera ahora" read like a failure. Where nobody keeps
  // watch there is nothing to report, and the two that remain fill the width.
  it('an unwatched beach carries no flag cell', () => {
    const r = cardSummary(input('es', { ...SCORED, bandera: null }));

    expect(r.cells).toHaveLength(2);
    expect(r.cells.map((c) => c.label)).toEqual(['Viento', 'Oleaje']);
  });

  it('with no measured wind or waves, it says so instead of inventing a value', () => {
    const r = cardSummary(input('es', { ...SCORED, vientoMs: null, oleaje: null }));

    const noData = 'Sin dato';
    expect(r.cells[0].value).toBe(noData);
    expect(r.cells[1].value).toBe(noData);
  });

  // The ranking rounds the wind on its own: 2.9 m/s scores as "sin viento"
  // while the forecast for the same moment says "flojo". The card ended up
  // showing both, one in the cell and the other on the line above.
  it('wind and waves come from the forecast, which is what the sheet paints', () => {
    const r = cardSummary({
      ...input('es'),
      forecast: { wind: 'Flojo', waves: 'Débil' },
    });

    expect(r.cells[0].value).toBe('Flojo');
    expect(r.cells[1].value).toBe('Débil');
  });

  it('trims the hourly strip to four and translates the sky to a glyph', () => {
    const r = cardSummary({
      ...input('es'),
      hours: [
        { horaIso: '2026-08-05T13:00:00Z', nubesPct: 10, temperaturaC: 21.4, vientoMs: 2.6 },
        { horaIso: '2026-08-05T14:00:00Z', nubesPct: 40, temperaturaC: 22, vientoMs: 3 },
        { horaIso: '2026-08-05T15:00:00Z', nubesPct: 90, temperaturaC: 22, vientoMs: 3 },
        { horaIso: '2026-08-05T16:00:00Z', nubesPct: null, temperaturaC: null, vientoMs: null },
        { horaIso: '2026-08-05T17:00:00Z', nubesPct: 0, temperaturaC: 20, vientoMs: 1 },
      ],
    });

    expect(r.hours).toHaveLength(4);
    expect(r.hours.map((h) => h.emoji)).toEqual(['☀️', '⛅', '☁️', '⛅']);
    expect(r.hours[0]).toMatchObject({ hour: '15:00', temperature: '21°', wind: '3 m/s' });
    // What is missing is stated, not filled in.
    expect(r.hours[3]).toMatchObject({ temperature: '--', wind: '--' });
  });

  it('sorts the tides by hour and strips AEMET of its note asterisk', () => {
    const r = cardSummary({
      ...input('es'),
      tides: { pleamar: ['06:12', '18:40'], bajamar: ['00:05', '12:25'] },
      tidePort: '*Puerto de Santander',
    });

    expect(r.tides.map((m) => m.hour)).toEqual(['00:05', '06:12', '12:25', '18:40']);
    expect(r.tides.map((m) => m.arrow)).toEqual(['↓', '↑', '↓', '↑']);
    expect(r.tidePort).toBe('Puerto de Santander');
  });

  it('with no hourly strip or tides, the card simply does not carry them', () => {
    const r = cardSummary(input('es'));

    expect(r.hours).toEqual([]);
    expect(r.tides).toEqual([]);
    expect(r.tidePort).toBeNull();
  });

  it('without a forecast it falls back to what the ranking measured', () => {
    const r = cardSummary({ ...input('es'), forecast: { wind: null, waves: null } });

    expect(r.cells[0].value).toBe('Sin viento');
    expect(r.cells[1].value).toBe('Débil');
  });

  // The notice travels INSIDE the image: a forwarded card without it reads as
  // a promise about the state of the sea, and it is not one.
  it('always carries the notice, the brand and the site', () => {
    const r = cardSummary(input('es'));

    expect(r.warning).toBe(es['aviso.ranking']);
    expect(r.brand).toBe('Playucas.es');
    expect(r.site).toBe('playucas.es');
  });
});

describe('shared file name', () => {
  it('is readable in the chat: beach and day, no accents or codes', () => {
    expect(cardFileName('La Maruca', NOW_ISO)).toBe('la-maruca-2026-08-05.png');
    expect(cardFileName('Somo / Loredo', NOW_ISO)).toBe('somo-loredo-2026-08-05.png');
    expect(cardFileName('Berría', NOW_ISO)).toBe('berria-2026-08-05.png');
  });
});
