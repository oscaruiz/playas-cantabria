import {
  withinHours,
  flagStatus,
  lastRecordedFlag,
  isRecentInfo,
  isRainActive,
  expectedRain,
  webcamCoverageKey,
  webcamAvailable,
  lifeguardAvailable,
  matchesBeach,
  normalizeSearch,
  skyEmoji,
  skyWord,
  isNightAt,
  rankedSkyEmoji,
  lifeguardOperator,
} from './beachHelpers';

// During the bathing season, Madrid is CEST (UTC+2): UTC + 2h = Madrid time.
const redCross = {
  horario: '11:30 - 19:30',
  coberturaDesde: '12-06-2026',
  coberturaHasta: '15-09-2026',
};

describe('withinHours', () => {
  it('true within hours (Madrid time)', () => {
    // 12:00 UTC = 14:00 Madrid → within 11:30-19:30
    expect(withinHours(redCross, new Date('2026-06-22T12:00:00Z'))).toBe(true);
  });

  it('false before the 11:30 hoisting', () => {
    // 08:00 UTC = 10:00 Madrid → before 11:30
    expect(withinHours(redCross, new Date('2026-06-22T08:00:00Z'))).toBe(false);
  });

  it('false after the 19:30 closing', () => {
    // 18:00 UTC = 20:00 Madrid → after 19:30
    expect(withinHours(redCross, new Date('2026-06-22T18:00:00Z'))).toBe(false);
  });

  it('false out of season even if it is mid-afternoon', () => {
    // Oct 1 14:00 Madrid → after coberturaHasta (15-09)
    expect(withinHours(redCross, new Date('2026-10-01T12:00:00Z'))).toBe(false);
  });

  it('null if there is no schedule', () => {
    expect(withinHours({ horario: null })).toBeNull();
    expect(withinHours(undefined)).toBeNull();
  });
});

describe('flagStatus', () => {
  it("'color' when a real flag is hoisted", () => {
    expect(flagStatus({ ...redCross, bandera: 'Verde' }, new Date('2026-06-22T12:00:00Z'))).toBe('color');
  });

  it("'fueraDeHorario' with no flag and outside hours", () => {
    expect(flagStatus({ ...redCross, bandera: 'Desconocida' }, new Date('2026-06-22T08:00:00Z'))).toBe(
      'fueraDeHorario'
    );
  });

  it("'sinDatos' with no flag but within hours (capture pending)", () => {
    expect(flagStatus({ ...redCross, bandera: 'Desconocida' }, new Date('2026-06-22T12:00:00Z'))).toBe(
      'sinDatos'
    );
  });

  it("'sinDatos' when the schedule is unknown", () => {
    expect(flagStatus({ bandera: 'Desconocida' })).toBe('sinDatos');
  });

  it("'color' with a recent flag within hours", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBe('color');
  });

  it("'sinDatos' with yesterday afternoon's flag seen today at midday", () => {
    // It used to come out in colour: with 24h, yesterday's 18:35 Madrid capture
    // was the freshest on opening today. That is 17 h — nobody has confirmed that
    // colour since yesterday, so it is not painted on any screen.
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-21T16:35:00Z' },
        new Date('2026-06-22T09:45:00Z')
      )
    ).toBe('sinDatos');
  });

  it("'sinDatos' with a flag older than 8h even within hours (freshness)", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T02:00:00Z' },
        new Date('2026-06-22T12:00:00Z') // 10h después
      )
    ).toBe('sinDatos');
  });

  it("'fueraDeHorario' even with today's flag, at night", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T18:00:00Z') // 20:00 Madrid
      )
    ).toBe('fueraDeHorario');
  });
});

describe('lastRecordedFlag', () => {
  const green = { ...redCross, bandera: 'Verde' };

  it('clamps a post-closing capture to 19:30 of that same day', () => {
    // Scraped at 23:00 Madrid (21:00Z): Cruz Roja keeps publishing the page,
    // but the flag stopped flying at 19:30 → that is the time that gets shown.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T21:00:00Z' },
      new Date('2026-06-22T21:05:00Z')
    );
    expect(r?.bandera).toBe('Verde');
    expect(r?.registradaIso).toBe('2026-06-22T17:30:00.000Z'); // 19:30 Madrid
  });

  it('before hoisting the flag from yesterday is no longer shown: it is over 8h old', () => {
    // 09:00 Madrid (07:00Z). The flag stopped flying yesterday at 19:30, 13.5 h
    // ago. It still says "Fuera de horario", but without colour.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T05:00:00Z' },
      new Date('2026-06-22T07:00:00Z')
    );
    expect(r).toBeNull();
  });

  it('the night of the same day does: 8h have not yet passed since closing', () => {
    // 23:00 Madrid (21:00Z): closed at 19:30, 3.5 h ago.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T21:00:00Z' },
      new Date('2026-06-22T21:00:00Z')
    );
    expect(r?.bandera).toBe('Verde');
  });

  it('keeps the exact time if the capture was within hours', () => {
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T16:00:00Z' }, // 18:00 Madrid
      new Date('2026-06-22T18:00:00Z') // 20:00 Madrid, already closed
    );
    expect(r?.registradaIso).toBe('2026-06-22T16:00:00.000Z');
  });

  it('null within hours (the current flag rules there)', () => {
    expect(
      lastRecordedFlag(
        { ...green, ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBeNull();
  });

  it('null if the record is over 8h old', () => {
    expect(
      lastRecordedFlag(
        { ...green, ultimaActualizacion: '2026-06-20T16:00:00Z' }, // 18:00 Madrid on the 20th
        new Date('2026-06-22T07:00:00Z') // 09:00 Madrid on the 22nd
      )
    ).toBeNull();
  });

  it('null out of season and with no coloured flag', () => {
    expect(
      lastRecordedFlag(
        { ...green, ultimaActualizacion: '2026-09-16T16:00:00Z' },
        new Date('2026-09-16T18:00:00Z') // coberturaHasta (15-09) already passed
      )
    ).toBeNull();
    expect(
      lastRecordedFlag(
        { ...redCross, bandera: 'Desconocida', ultimaActualizacion: '2026-06-22T16:00:00Z' },
        new Date('2026-06-22T18:00:00Z')
      )
    ).toBeNull();
  });
});

describe('esInfoReciente', () => {
  const now = new Date('2026-06-22T12:00:00Z'); // 14:00 Madrid, on the 22nd

  it('true if the capture is ≤8h old', () => {
    expect(isRecentInfo('2026-06-22T09:00:00Z', now)).toBe(true); // 3h
    expect(isRecentInfo('2026-06-22T04:30:00Z', now)).toBe(true); // 7.5h
  });

  it('false if the capture is over 8h old', () => {
    expect(isRecentInfo('2026-06-22T03:00:00Z', now)).toBe(false); // 9h
    expect(isRecentInfo('2026-06-21T16:00:00Z', now)).toBe(false); // 20h
  });

  it('true (lenient) if the ISO does not parse', () => {
    expect(isRecentInfo('no-es-fecha', now)).toBe(true);
  });
});

describe('webcamDisponible', () => {
  it('true only if there is a webcam and it is not deactivated', () => {
    expect(webcamAvailable({ estado: 'activa' })).toBe(true);
    expect(webcamAvailable({})).toBe(true);
    expect(webcamAvailable({ estado: 'desactivada' })).toBe(false);
    expect(webcamAvailable(null)).toBe(false);
    expect(webcamAvailable(undefined)).toBe(false);
  });
});

describe('claveCoberturaWebcam', () => {
  it('maps each coverage to its i18n key', () => {
    expect(webcamCoverageKey('exacta')).toBe('webcam.enDirecto');
    expect(webcamCoverageKey('compartida')).toBe('webcam.vistaPanoramica');
    expect(webcamCoverageKey('cercana')).toBe('webcam.cercana');
  });
});

describe('isRainActive', () => {
  it('true with the backend structured signal (multi-source)', () => {
    expect(
      isRainActive({ cielo: 'muy nuboso', precipitacionMm: null, lluvia: { estado: 'lloviendo' } })
    ).toBe(true);
  });

  it('the structured "sin_lluvia" signal is authoritative (ignores the sky regex)', () => {
    // The nowcast already aggregates all the sources; if it says dry, don't contradict it.
    expect(
      isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })
    ).toBe(false);
  });

  it('falls back to observed mm when there is no structured signal', () => {
    expect(isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0.3 })).toBe(true);
    expect(isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0 })).toBe(false);
  });

  it('falls back to a regex over the sky text (old backends)', () => {
    expect(isRainActive({ cielo: 'lluvia ligera', precipitacionMm: null })).toBe(true);
    expect(isRainActive({ cielo: 'chubascos tormentosos', precipitacionMm: null })).toBe(true);
    expect(isRainActive({ cielo: 'despejado', precipitacionMm: null })).toBe(false);
  });

  it('with an unknown state falls through to the fallbacks', () => {
    expect(
      isRainActive({ cielo: 'llovizna', precipitacionMm: null, lluvia: { estado: 'desconocido' } })
    ).toBe(true);
  });

  it('false without data', () => {
    expect(isRainActive(null)).toBe(false);
    expect(isRainActive(undefined)).toBe(false);
  });
});

describe('lluviaPrevista', () => {
  const expected = { desdeIso: '2026-07-15T16:30:00Z', mm: 0.6, fuentes: ['OpenMeteo'] };

  it('returns the forecast when it is not raining yet', () => {
    expect(
      expectedRain({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia', prevista: expected } })
    ).toEqual(expected);
  });

  it('null if it is already raining (the active rain badge takes priority)', () => {
    expect(
      expectedRain({ cielo: 'lluvia ligera', precipitacionMm: 0.3, lluvia: { estado: 'lloviendo', prevista: expected } })
    ).toBeNull();
  });

  it('null without a forecast signal or without data', () => {
    expect(expectedRain({ cielo: 'despejado', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })).toBeNull();
    expect(expectedRain(null)).toBeNull();
  });
});

describe('normalizeSearch', () => {
  it('lowercase and without accents', () => {
    expect(normalizeSearch('Arnía')).toBe('arnia');
    expect(normalizeSearch('TRENGANDÍN')).toBe('trengandin');
    expect(normalizeSearch('Mataleñas')).toBe('matalenas');
  });
});

describe('coincidePlaya — search by name, municipality and alias', () => {
  const arnia = { nombre: 'La Arnía', municipio: 'Piélagos', alias: ['Arnia'] };
  const gerra = {
    nombre: 'El Cabo / Gerra / Bederna',
    municipio: 'San Vicente de la Barquera',
    alias: ['Gerra', 'El Cabo', 'Bederna'],
  };

  it('finds by canonical name ignoring accents', () => {
    expect(matchesBeach(arnia, 'arnia')).toBe(true);
    expect(matchesBeach(arnia, 'Arní')).toBe(true);
  });

  it('finds by municipality', () => {
    expect(matchesBeach(arnia, 'piélagos')).toBe(true);
  });

  it('finds by alias (place name / station)', () => {
    expect(matchesBeach(gerra, 'gerra')).toBe(true);
    expect(matchesBeach(gerra, 'bederna')).toBe(true);
  });

  it('does not match unrelated terms', () => {
    expect(matchesBeach(arnia, 'sardinero')).toBe(false);
  });

  it('does not break without an alias', () => {
    expect(matchesBeach({ nombre: 'Somo', municipio: 'Ribamontán al Mar' }, 'somo')).toBe(true);
  });
});

describe('lifeguardAvailable', () => {
  it('uses the explicit operator for providers other than Cruz Roja', () => {
    expect(lifeguardAvailable({ fuenteBanderas: 'DYA', idCruzRoja: 0 })).toBe(true);
  });

  it('honours an explicit null even if legacy fields remain', () => {
    expect(lifeguardAvailable({
      fuenteBanderas: null,
      idCruzRoja: 482,
      cruzRojaStations: [{ id: 373 }],
    })).toBe(false);
  });

  it('detects the compatibility idCruzRoja', () => {
    expect(lifeguardAvailable({ idCruzRoja: 482 })).toBe(true);
  });

  it('detects stations even without idCruzRoja', () => {
    // Case of La Concha in the fallback's raw JSON: stations only.
    expect(lifeguardAvailable({ cruzRojaStations: [{ id: 373 }, { id: 820 }] })).toBe(true);
  });

  it('detects stations even if idCruzRoja is 0', () => {
    // Case of the DTO when the backend could not derive the id.
    expect(lifeguardAvailable({ idCruzRoja: 0, cruzRojaStations: [{ id: 373 }] })).toBe(true);
  });

  it('does not count a station without a verified id', () => {
    expect(lifeguardAvailable({ idCruzRoja: 0, cruzRojaStations: [{}] })).toBe(false);
  });

  it('does not count a station with id 0', () => {
    expect(lifeguardAvailable({ cruzRojaStations: [{ id: 0 }] })).toBe(false);
  });

  it('with no source it is false', () => {
    expect(lifeguardAvailable({ idCruzRoja: 0 })).toBe(false);
    expect(lifeguardAvailable({})).toBe(false);
    expect(lifeguardAvailable(undefined)).toBe(false);
    expect(lifeguardAvailable(null)).toBe(false);
  });
});

describe('skyEmoji', () => {
  // The emojis are written escaped, just like in beachHelpers.ts, so that
  // the file doesn't depend on how each editor represents the modifiers.
  const SUN = '\u2600\uFE0F';
  const SUN_CLOUD = '\u{1F324}\uFE0F';
  const CLOUD_SUN = '\u26C5';
  const CLOUDS = '\u2601\uFE0F';
  const STORM = '\u26C8\uFE0F';
  const RAIN = '\u{1F327}\uFE0F';
  const SNOW = '\u{1F328}\uFE0F';
  const FOG = '\u{1F32B}\uFE0F';

  it('gives sun for the clear sky of both sources', () => {
    // OpenWeather says "cielo claro" (01x) where AEMET says "despejado".
    expect(skyEmoji('cielo claro')).toBe(SUN);
    expect(skyEmoji('Despejado')).toBe(SUN);
    expect(skyEmoji('cielo despejado')).toBe(SUN);
    expect(skyEmoji('soleado')).toBe(SUN);
  });

  it('gives sun behind clouds for partial coverages', () => {
    expect(skyEmoji('poco nuboso')).toBe(SUN_CLOUD);
    expect(skyEmoji('Intervalos nubosos')).toBe(SUN_CLOUD);
    expect(skyEmoji('nubes dispersas')).toBe(SUN_CLOUD);
    expect(skyEmoji('algo de nubes')).toBe(SUN_CLOUD);
    // 'parcial' beats 'soleado', which would otherwise take it entirely.
    expect(skyEmoji('parcialmente soleado')).toBe(SUN_CLOUD);
  });

  it('tells overcast from cloudy', () => {
    expect(skyEmoji('muy nuboso')).toBe(CLOUDS);
    expect(skyEmoji('cubierto')).toBe(CLOUDS);
    // Plain 'nubes' is OpenWeather's 04x, which is overcast.
    expect(skyEmoji('nubes')).toBe(CLOUDS);
    expect(skyEmoji('nuboso')).toBe(CLOUD_SUN);
    expect(skyEmoji('cielo nublado')).toBe(CLOUD_SUN);
  });

  it('precipitation beats coverage in AEMET combined states', () => {
    // Before, the cloud or the sun came out and the rain got lost entirely.
    expect(skyEmoji('Cubierto con lluvia')).toBe(RAIN);
    expect(skyEmoji('Cubierto con lluvia escasa')).toBe(RAIN);
    expect(skyEmoji('Intervalos nubosos con lluvia')).toBe(RAIN);
    expect(skyEmoji('Intervalos nubosos con lluvia escasa')).toBe(RAIN);
    expect(skyEmoji('Muy nuboso con nieve')).toBe(SNOW);
    expect(skyEmoji('Nuboso con tormenta')).toBe(STORM);
  });

  it('covers the remaining phenomena', () => {
    expect(skyEmoji('lluvia ligera')).toBe(RAIN);
    expect(skyEmoji('llovizna')).toBe(RAIN);
    expect(skyEmoji('chubascos')).toBe(RAIN);
    expect(skyEmoji('tormenta')).toBe(STORM);
    // 'tormentosos' does not contain 'tormenta'; that's why the pattern is 'torment'.
    expect(skyEmoji('chubascos tormentosos')).toBe(STORM);
    expect(skyEmoji('nieve')).toBe(SNOW);
    expect(skyEmoji('niebla')).toBe(FOG);
    expect(skyEmoji('bruma')).toBe(FOG);
  });

  it('falls back to the generic one without data or when unrecognized', () => {
    expect(skyEmoji(null)).toBe(CLOUD_SUN);
    expect(skyEmoji('')).toBe(CLOUD_SUN);
    expect(skyEmoji('vete a saber')).toBe(CLOUD_SUN);
  });
});

describe('lifeguardOperator', () => {
  it('returns the operator the backend reports', () => {
    expect(lifeguardOperator({ fuenteBanderas: 'DYA' })).toBe('DYA');
  });

  it('returns null when the backend says there is no service', () => {
    expect(lifeguardOperator({ fuenteBanderas: null })).toBeNull();
  });

  it('tells "no service" from "the backend does not report it"', () => {
    // The local fallback catalog and the backend deployed before this feature
    // carry no field at all: they must keep showing what they always showed.
    expect(lifeguardOperator({})).toBe('Cruz Roja');
    expect(lifeguardOperator(undefined)).toBe('Cruz Roja');
  });
});

/**
 * One sky, one word.
 *
 * The listing and the detail described the same sky with two vocabularies —
 * "Sol" against "cielo claro", "Parcialmente soleado" against "algo de
 * nubes" — on 46 of 46 beaches, and both wordings appeared together on the
 * detail page.
 */
describe('skyWord', () => {
  it('gives the same word for AEMET and OpenWeather synonyms', () => {
    // What really diverged: the home page said the left one and the detail
    // printed the right one.
    expect(skyWord('cielo claro')).toBe('Sol');
    expect(skyWord('despejado')).toBe('Sol');
    expect(skyWord('algo de nubes')).toBe('Parcialmente soleado');
    expect(skyWord('nubes dispersas')).toBe('Parcialmente soleado');
    expect(skyWord('intervalos nubosos')).toBe('Parcialmente soleado');
    expect(skyWord('muy nuboso')).toBe('Nublado');
    expect(skyWord('cubierto')).toBe('Nublado');
  });

  it('the phenomenon rules over the cloudiness', () => {
    // AEMET puts coverage and precipitation in the same string: looking at the
    // clouds first would give "Nublado" over a sky that is raining.
    expect(skyWord('Cubierto con lluvia')).toBe('Lluvia');
    expect(skyWord('Intervalos nubosos con lluvia escasa')).toBe('Lluvia');
    expect(skyWord('chubascos tormentosos')).toBe('Tormenta');
    expect(skyWord('Nuboso con niebla')).toBe('Niebla');
  });

  it('«parcialmente soleado» is not read as clear', () => {
    expect(skyWord('parcialmente soleado')).toBe('Parcialmente soleado');
  });

  it('returns null instead of inventing: the caller shows the raw text', () => {
    expect(skyWord('calima')).toBeNull();
    expect(skyWord('')).toBeNull();
    expect(skyWord(null)).toBeNull();
    expect(skyWord(undefined)).toBeNull();
  });
});

/**
 * Night.
 *
 * The provider's own icon carries the `d`/`n` suffix, so it follows the real
 * sunset at those coordinates. Before this, a clear sky at 3 a.m. showed a
 * sun and read "Sol".
 */
describe('night sky', () => {
  it('a clear sky at night is not «Sol», it is «Despejado»', () => {
    expect(skyWord('cielo claro', true)).toBe('Despejado');
    expect(skyWord('despejado', true)).toBe('Despejado');
    expect(skyWord('algo de nubes', true)).toBe('Parcialmente despejado');
  });

  it('and it carries a moon, not a sun', () => {
    expect(skyEmoji('cielo claro', true)).toBe('\u{1F319}');
    expect(skyEmoji('algo de nubes', true)).toBe('\u{1F319}');
    expect(skyEmoji(null, true)).toBe('\u{1F319}');
  });

  it('the phenomenon still rules: it rains at night too', () => {
    expect(skyWord('Cubierto con lluvia', true)).toBe('Lluvia');
    expect(skyEmoji('lluvia', true)).toBe('\u{1F327}\uFE0F');
    expect(skyEmoji('niebla', true)).toBe('\u{1F32B}\uFE0F');
  });

  it('cloudy does not change: there was no sun to remove', () => {
    expect(skyWord('muy nuboso', true)).toBe('Nublado');
    expect(skyEmoji('muy nuboso', true)).toBe('\u2601\uFE0F');
  });

  it('by day it behaves as before', () => {
    expect(skyWord('cielo claro')).toBe('Sol');
    expect(skyEmoji('cielo claro')).toBe('\u2600\uFE0F');
    expect(skyEmoji('algo de nubes')).toBe('\u{1F324}\uFE0F');
  });
});

describe('esNocheEn', () => {
  it('reads the provider icon suffix', () => {
    expect(isNightAt({ iconoClima: '01n' })).toBe(true);
    expect(isNightAt({ iconoClima: '04n' })).toBe(true);
    expect(isNightAt({ iconoClima: '01d' })).toBe(false);
  });

  it('without an icon assumes daytime instead of inventing', () => {
    expect(isNightAt({ iconoClima: null })).toBe(false);
    expect(isNightAt({})).toBe(false);
    expect(isNightAt(null)).toBe(false);
    expect(isNightAt(undefined)).toBe(false);
  });
});

describe('rankedSkyEmoji', () => {
  const RAIN = '\u{1F327}️';
  const CLOUDS = '☁️';
  const MOON = '\u{1F319}';
  const SUN = '☀️';

  it('the live rain signal beats the model sky (the map case)', () => {
    // OpenWeather current says "nubes" while the aggregated nowcast says raining.
    expect(rankedSkyEmoji({
      descripcionClima: 'nubes',
      iconoClima: '04d',
      lluvia: { estado: 'lloviendo' },
    })).toBe(RAIN);
  });

  it('without a signal (old backend or nowcast down) it behaves as always', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'nubes', iconoClima: '04d' })).toBe(CLOUDS);
    expect(rankedSkyEmoji({ descripcionClima: 'nubes', iconoClima: '04d', lluvia: null })).toBe(CLOUDS);
  });

  it('explicit sin_lluvia does not force rain and respects the sky', () => {
    expect(rankedSkyEmoji({
      descripcionClima: 'cielo claro',
      iconoClima: '01d',
      lluvia: { estado: 'sin_lluvia' },
    })).toBe(SUN);
  });

  it('night still works: moon with a clear night sky, rain even at night', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'cielo claro', iconoClima: '01n' })).toBe(MOON);
    expect(rankedSkyEmoji({
      descripcionClima: 'nubes',
      iconoClima: '04n',
      lluvia: { estado: 'lloviendo' },
    })).toBe(RAIN);
  });

  it('the rain text of the sky itself still gives rain (previous behaviour)', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'lluvia ligera', iconoClima: '10d' })).toBe(RAIN);
  });
});
