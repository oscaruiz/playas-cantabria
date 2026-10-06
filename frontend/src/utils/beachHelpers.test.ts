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

describe('dentroDeHorario', () => {
  it('true dentro del horario (hora de Madrid)', () => {
    // 12:00 UTC = 14:00 Madrid → within 11:30-19:30
    expect(withinHours(redCross, new Date('2026-06-22T12:00:00Z'))).toBe(true);
  });

  it('false antes del izado de las 11:30', () => {
    // 08:00 UTC = 10:00 Madrid → before 11:30
    expect(withinHours(redCross, new Date('2026-06-22T08:00:00Z'))).toBe(false);
  });

  it('false tras el cierre de las 19:30', () => {
    // 18:00 UTC = 20:00 Madrid → after 19:30
    expect(withinHours(redCross, new Date('2026-06-22T18:00:00Z'))).toBe(false);
  });

  it('false fuera de temporada aunque sea media tarde', () => {
    // Oct 1 14:00 Madrid → after coberturaHasta (15-09)
    expect(withinHours(redCross, new Date('2026-10-01T12:00:00Z'))).toBe(false);
  });

  it('null si no hay horario', () => {
    expect(withinHours({ horario: null })).toBeNull();
    expect(withinHours(undefined)).toBeNull();
  });
});

describe('estadoBandera', () => {
  it("'color' cuando hay bandera real izada", () => {
    expect(flagStatus({ ...redCross, bandera: 'Verde' }, new Date('2026-06-22T12:00:00Z'))).toBe('color');
  });

  it("'fueraDeHorario' sin bandera y fuera del horario", () => {
    expect(flagStatus({ ...redCross, bandera: 'Desconocida' }, new Date('2026-06-22T08:00:00Z'))).toBe(
      'fueraDeHorario'
    );
  });

  it("'sinDatos' sin bandera pero dentro del horario (captura pendiente)", () => {
    expect(flagStatus({ ...redCross, bandera: 'Desconocida' }, new Date('2026-06-22T12:00:00Z'))).toBe(
      'sinDatos'
    );
  });

  it("'sinDatos' cuando no se conoce el horario", () => {
    expect(flagStatus({ bandera: 'Desconocida' })).toBe('sinDatos');
  });

  it("'color' con bandera reciente dentro del horario", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBe('color');
  });

  it("'sinDatos' con la bandera de ayer tarde vista hoy a mediodía", () => {
    // Antes salía en color: con 24h, la captura de ayer 18:35 Madrid era la más
    // fresca al abrir hoy. Son 17 h — nadie ha confirmado ese color desde ayer,
    // así que no se pinta en ninguna pantalla.
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-21T16:35:00Z' },
        new Date('2026-06-22T09:45:00Z')
      )
    ).toBe('sinDatos');
  });

  it("'sinDatos' con bandera de más de 8h aunque sea dentro del horario (frescura)", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T02:00:00Z' },
        new Date('2026-06-22T12:00:00Z') // 10h después
      )
    ).toBe('sinDatos');
  });

  it("'fueraDeHorario' aunque haya bandera de hoy, si es de noche", () => {
    expect(
      flagStatus(
        { ...redCross, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T18:00:00Z') // 20:00 Madrid
      )
    ).toBe('fueraDeHorario');
  });
});

describe('ultimaBanderaRegistrada', () => {
  const green = { ...redCross, bandera: 'Verde' };

  it('acota la captura posterior al cierre a las 19:30 de ese mismo día', () => {
    // Scraped at 23:00 Madrid (21:00Z): Cruz Roja keeps publishing the page,
    // but the flag stopped flying at 19:30 → that is the time that gets shown.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T21:00:00Z' },
      new Date('2026-06-22T21:05:00Z')
    );
    expect(r?.bandera).toBe('Verde');
    expect(r?.registradaIso).toBe('2026-06-22T17:30:00.000Z'); // 19:30 Madrid
  });

  it('antes del izado ya no se enseña la de ayer: pasa de 8h', () => {
    // 09:00 Madrid (07:00Z). La bandera dejó de ondear ayer a las 19:30, hace
    // 13,5 h. Se sigue diciendo "Fuera de horario", pero sin color.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T05:00:00Z' },
      new Date('2026-06-22T07:00:00Z')
    );
    expect(r).toBeNull();
  });

  it('la noche del mismo día sí: aún no han pasado 8h desde el cierre', () => {
    // 23:00 Madrid (21:00Z): cerró a las 19:30, hace 3,5 h.
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T21:00:00Z' },
      new Date('2026-06-22T21:00:00Z')
    );
    expect(r?.bandera).toBe('Verde');
  });

  it('conserva la hora exacta si la captura fue dentro del horario', () => {
    const r = lastRecordedFlag(
      { ...green, ultimaActualizacion: '2026-06-22T16:00:00Z' }, // 18:00 Madrid
      new Date('2026-06-22T18:00:00Z') // 20:00 Madrid, already closed
    );
    expect(r?.registradaIso).toBe('2026-06-22T16:00:00.000Z');
  });

  it('null dentro de horario (ahí manda la bandera vigente)', () => {
    expect(
      lastRecordedFlag(
        { ...green, ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBeNull();
  });

  it('null si el registro pasa de 8h', () => {
    expect(
      lastRecordedFlag(
        { ...green, ultimaActualizacion: '2026-06-20T16:00:00Z' }, // 18:00 Madrid del 20
        new Date('2026-06-22T07:00:00Z') // 09:00 Madrid del 22
      )
    ).toBeNull();
  });

  it('null fuera de temporada y sin bandera con color', () => {
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

  it('true si la captura tiene ≤8h', () => {
    expect(isRecentInfo('2026-06-22T09:00:00Z', now)).toBe(true); // 3h
    expect(isRecentInfo('2026-06-22T04:30:00Z', now)).toBe(true); // 7,5h
  });

  it('false si la captura pasa de 8h', () => {
    expect(isRecentInfo('2026-06-22T03:00:00Z', now)).toBe(false); // 9h
    expect(isRecentInfo('2026-06-21T16:00:00Z', now)).toBe(false); // 20h
  });

  it('true (lenient) si el ISO no parsea', () => {
    expect(isRecentInfo('no-es-fecha', now)).toBe(true);
  });
});

describe('webcamDisponible', () => {
  it('true solo si hay webcam y no está desactivada', () => {
    expect(webcamAvailable({ estado: 'activa' })).toBe(true);
    expect(webcamAvailable({})).toBe(true);
    expect(webcamAvailable({ estado: 'desactivada' })).toBe(false);
    expect(webcamAvailable(null)).toBe(false);
    expect(webcamAvailable(undefined)).toBe(false);
  });
});

describe('claveCoberturaWebcam', () => {
  it('mapea cada cobertura a su clave i18n', () => {
    expect(webcamCoverageKey('exacta')).toBe('webcam.enDirecto');
    expect(webcamCoverageKey('compartida')).toBe('webcam.vistaPanoramica');
    expect(webcamCoverageKey('cercana')).toBe('webcam.cercana');
  });
});

describe('esLluviaActiva', () => {
  it('true con la señal estructurada del backend (multi-fuente)', () => {
    expect(
      isRainActive({ cielo: 'muy nuboso', precipitacionMm: null, lluvia: { estado: 'lloviendo' } })
    ).toBe(true);
  });

  it('la señal estructurada "sin_lluvia" es autoritativa (ignora el regex del cielo)', () => {
    // The nowcast already aggregates all the sources; if it says dry, don't contradict it.
    expect(
      isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })
    ).toBe(false);
  });

  it('fallback por mm observados cuando no hay señal estructurada', () => {
    expect(isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0.3 })).toBe(true);
    expect(isRainActive({ cielo: 'muy nuboso', precipitacionMm: 0 })).toBe(false);
  });

  it('fallback por regex sobre el texto del cielo (backends antiguos)', () => {
    expect(isRainActive({ cielo: 'lluvia ligera', precipitacionMm: null })).toBe(true);
    expect(isRainActive({ cielo: 'chubascos tormentosos', precipitacionMm: null })).toBe(true);
    expect(isRainActive({ cielo: 'despejado', precipitacionMm: null })).toBe(false);
  });

  it('con estado desconocido cae a los fallbacks', () => {
    expect(
      isRainActive({ cielo: 'llovizna', precipitacionMm: null, lluvia: { estado: 'desconocido' } })
    ).toBe(true);
  });

  it('false sin datos', () => {
    expect(isRainActive(null)).toBe(false);
    expect(isRainActive(undefined)).toBe(false);
  });
});

describe('lluviaPrevista', () => {
  const expected = { desdeIso: '2026-07-15T16:30:00Z', mm: 0.6, fuentes: ['OpenMeteo'] };

  it('devuelve la previsión cuando no llueve todavía', () => {
    expect(
      expectedRain({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia', prevista: expected } })
    ).toEqual(expected);
  });

  it('null si ya está lloviendo (el badge de lluvia activa tiene prioridad)', () => {
    expect(
      expectedRain({ cielo: 'lluvia ligera', precipitacionMm: 0.3, lluvia: { estado: 'lloviendo', prevista: expected } })
    ).toBeNull();
  });

  it('null sin señal de previsión o sin datos', () => {
    expect(expectedRain({ cielo: 'despejado', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })).toBeNull();
    expect(expectedRain(null)).toBeNull();
  });
});

describe('normalizarBusqueda', () => {
  it('minúsculas y sin tildes', () => {
    expect(normalizeSearch('Arnía')).toBe('arnia');
    expect(normalizeSearch('TRENGANDÍN')).toBe('trengandin');
    expect(normalizeSearch('Mataleñas')).toBe('matalenas');
  });
});

describe('coincidePlaya — búsqueda por nombre, municipio y alias', () => {
  const arnia = { nombre: 'La Arnía', municipio: 'Piélagos', alias: ['Arnia'] };
  const gerra = {
    nombre: 'El Cabo / Gerra / Bederna',
    municipio: 'San Vicente de la Barquera',
    alias: ['Gerra', 'El Cabo', 'Bederna'],
  };

  it('encuentra por nombre canónico ignorando tildes', () => {
    expect(matchesBeach(arnia, 'arnia')).toBe(true);
    expect(matchesBeach(arnia, 'Arní')).toBe(true);
  });

  it('encuentra por municipio', () => {
    expect(matchesBeach(arnia, 'piélagos')).toBe(true);
  });

  it('encuentra por alias (topónimo / puesto)', () => {
    expect(matchesBeach(gerra, 'gerra')).toBe(true);
    expect(matchesBeach(gerra, 'bederna')).toBe(true);
  });

  it('no coincide con términos ajenos', () => {
    expect(matchesBeach(arnia, 'sardinero')).toBe(false);
  });

  it('sin alias no rompe', () => {
    expect(matchesBeach({ nombre: 'Somo', municipio: 'Ribamontán al Mar' }, 'somo')).toBe(true);
  });
});

describe('vigilanciaDisponible', () => {
  it('usa el operador explícito para proveedores que no son Cruz Roja', () => {
    expect(lifeguardAvailable({ fuenteBanderas: 'DYA', idCruzRoja: 0 })).toBe(true);
  });

  it('respeta el null explícito aunque queden campos legados', () => {
    expect(lifeguardAvailable({
      fuenteBanderas: null,
      idCruzRoja: 482,
      cruzRojaStations: [{ id: 373 }],
    })).toBe(false);
  });

  it('detecta el idCruzRoja de compatibilidad', () => {
    expect(lifeguardAvailable({ idCruzRoja: 482 })).toBe(true);
  });

  it('detecta los puestos aunque no haya idCruzRoja', () => {
    // Case of La Concha in the fallback's raw JSON: stations only.
    expect(lifeguardAvailable({ cruzRojaStations: [{ id: 373 }, { id: 820 }] })).toBe(true);
  });

  it('detecta los puestos aunque el idCruzRoja venga a 0', () => {
    // Case of the DTO when the backend could not derive the id.
    expect(lifeguardAvailable({ idCruzRoja: 0, cruzRojaStations: [{ id: 373 }] })).toBe(true);
  });

  it('no cuenta un puesto sin id verificado', () => {
    expect(lifeguardAvailable({ idCruzRoja: 0, cruzRojaStations: [{}] })).toBe(false);
  });

  it('no cuenta un puesto con id 0', () => {
    expect(lifeguardAvailable({ cruzRojaStations: [{ id: 0 }] })).toBe(false);
  });

  it('sin ninguna fuente es falso', () => {
    expect(lifeguardAvailable({ idCruzRoja: 0 })).toBe(false);
    expect(lifeguardAvailable({})).toBe(false);
    expect(lifeguardAvailable(undefined)).toBe(false);
    expect(lifeguardAvailable(null)).toBe(false);
  });
});

describe('emojiCielo', () => {
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

  it('da sol para el despejado de las dos fuentes', () => {
    // OpenWeather says "cielo claro" (01x) where AEMET says "despejado".
    expect(skyEmoji('cielo claro')).toBe(SUN);
    expect(skyEmoji('Despejado')).toBe(SUN);
    expect(skyEmoji('cielo despejado')).toBe(SUN);
    expect(skyEmoji('soleado')).toBe(SUN);
  });

  it('da sol entre nubes para las coberturas parciales', () => {
    expect(skyEmoji('poco nuboso')).toBe(SUN_CLOUD);
    expect(skyEmoji('Intervalos nubosos')).toBe(SUN_CLOUD);
    expect(skyEmoji('nubes dispersas')).toBe(SUN_CLOUD);
    expect(skyEmoji('algo de nubes')).toBe(SUN_CLOUD);
    // 'parcial' beats 'soleado', which would otherwise take it entirely.
    expect(skyEmoji('parcialmente soleado')).toBe(SUN_CLOUD);
  });

  it('distingue el cubierto del nuboso', () => {
    expect(skyEmoji('muy nuboso')).toBe(CLOUDS);
    expect(skyEmoji('cubierto')).toBe(CLOUDS);
    // Plain 'nubes' is OpenWeather's 04x, which is overcast.
    expect(skyEmoji('nubes')).toBe(CLOUDS);
    expect(skyEmoji('nuboso')).toBe(CLOUD_SUN);
    expect(skyEmoji('cielo nublado')).toBe(CLOUD_SUN);
  });

  it('la precipitación gana a la cobertura en los estados combinados de AEMET', () => {
    // Before, the cloud or the sun came out and the rain got lost entirely.
    expect(skyEmoji('Cubierto con lluvia')).toBe(RAIN);
    expect(skyEmoji('Cubierto con lluvia escasa')).toBe(RAIN);
    expect(skyEmoji('Intervalos nubosos con lluvia')).toBe(RAIN);
    expect(skyEmoji('Intervalos nubosos con lluvia escasa')).toBe(RAIN);
    expect(skyEmoji('Muy nuboso con nieve')).toBe(SNOW);
    expect(skyEmoji('Nuboso con tormenta')).toBe(STORM);
  });

  it('cubre el resto de fenómenos', () => {
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

  it('cae al genérico sin dato o sin reconocer', () => {
    expect(skyEmoji(null)).toBe(CLOUD_SUN);
    expect(skyEmoji('')).toBe(CLOUD_SUN);
    expect(skyEmoji('vete a saber')).toBe(CLOUD_SUN);
  });
});

describe('operadorVigilancia', () => {
  it('devuelve el operador que informa el backend', () => {
    expect(lifeguardOperator({ fuenteBanderas: 'DYA' })).toBe('DYA');
  });

  it('devuelve null cuando el backend dice que no hay servicio', () => {
    expect(lifeguardOperator({ fuenteBanderas: null })).toBeNull();
  });

  it('distingue "no hay servicio" de "el backend no lo informa"', () => {
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
describe('palabraCielo', () => {
  it('da la misma palabra para los sinónimos de AEMET y de OpenWeather', () => {
    // Lo que de verdad divergía: la portada decía la izquierda y el detalle
    // imprimía la derecha.
    expect(skyWord('cielo claro')).toBe('Sol');
    expect(skyWord('despejado')).toBe('Sol');
    expect(skyWord('algo de nubes')).toBe('Parcialmente soleado');
    expect(skyWord('nubes dispersas')).toBe('Parcialmente soleado');
    expect(skyWord('intervalos nubosos')).toBe('Parcialmente soleado');
    expect(skyWord('muy nuboso')).toBe('Nublado');
    expect(skyWord('cubierto')).toBe('Nublado');
  });

  it('el fenómeno manda sobre la nubosidad', () => {
    // AEMET mete cobertura y precipitación en la misma cadena: mirar primero
    // las nubes daría "Nublado" sobre un cielo que está lloviendo.
    expect(skyWord('Cubierto con lluvia')).toBe('Lluvia');
    expect(skyWord('Intervalos nubosos con lluvia escasa')).toBe('Lluvia');
    expect(skyWord('chubascos tormentosos')).toBe('Tormenta');
    expect(skyWord('Nuboso con niebla')).toBe('Niebla');
  });

  it('«parcialmente soleado» no se lee como despejado', () => {
    expect(skyWord('parcialmente soleado')).toBe('Parcialmente soleado');
  });

  it('devuelve null en vez de inventar: el llamante enseña el texto crudo', () => {
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
describe('cielo de noche', () => {
  it('un cielo despejado de noche no es «Sol», es «Despejado»', () => {
    expect(skyWord('cielo claro', true)).toBe('Despejado');
    expect(skyWord('despejado', true)).toBe('Despejado');
    expect(skyWord('algo de nubes', true)).toBe('Parcialmente despejado');
  });

  it('y lleva luna, no sol', () => {
    expect(skyEmoji('cielo claro', true)).toBe('\u{1F319}');
    expect(skyEmoji('algo de nubes', true)).toBe('\u{1F319}');
    expect(skyEmoji(null, true)).toBe('\u{1F319}');
  });

  it('el fenómeno sigue mandando: de noche también llueve', () => {
    expect(skyWord('Cubierto con lluvia', true)).toBe('Lluvia');
    expect(skyEmoji('lluvia', true)).toBe('\u{1F327}\uFE0F');
    expect(skyEmoji('niebla', true)).toBe('\u{1F32B}\uFE0F');
  });

  it('nublado no cambia: no había sol que quitar', () => {
    expect(skyWord('muy nuboso', true)).toBe('Nublado');
    expect(skyEmoji('muy nuboso', true)).toBe('\u2601\uFE0F');
  });

  it('de día se comporta igual que antes', () => {
    expect(skyWord('cielo claro')).toBe('Sol');
    expect(skyEmoji('cielo claro')).toBe('\u2600\uFE0F');
    expect(skyEmoji('algo de nubes')).toBe('\u{1F324}\uFE0F');
  });
});

describe('esNocheEn', () => {
  it('lee el sufijo del icono del proveedor', () => {
    expect(isNightAt({ iconoClima: '01n' })).toBe(true);
    expect(isNightAt({ iconoClima: '04n' })).toBe(true);
    expect(isNightAt({ iconoClima: '01d' })).toBe(false);
  });

  it('sin icono asume de día en vez de inventar', () => {
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

  it('la señal viva de lluvia gana al cielo del modelo (el caso del mapa)', () => {
    // OpenWeather current says "nubes" while the aggregated nowcast says raining.
    expect(rankedSkyEmoji({
      descripcionClima: 'nubes',
      iconoClima: '04d',
      lluvia: { estado: 'lloviendo' },
    })).toBe(RAIN);
  });

  it('sin señal (backend viejo o nowcast caído) se comporta como siempre', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'nubes', iconoClima: '04d' })).toBe(CLOUDS);
    expect(rankedSkyEmoji({ descripcionClima: 'nubes', iconoClima: '04d', lluvia: null })).toBe(CLOUDS);
  });

  it('sin_lluvia explícito no fuerza lluvia y respeta el cielo', () => {
    expect(rankedSkyEmoji({
      descripcionClima: 'cielo claro',
      iconoClima: '01d',
      lluvia: { estado: 'sin_lluvia' },
    })).toBe(SUN);
  });

  it('la noche sigue funcionando: luna con despejado nocturno, lluvia aunque sea de noche', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'cielo claro', iconoClima: '01n' })).toBe(MOON);
    expect(rankedSkyEmoji({
      descripcionClima: 'nubes',
      iconoClima: '04n',
      lluvia: { estado: 'lloviendo' },
    })).toBe(RAIN);
  });

  it('el texto de lluvia del propio cielo sigue dando lluvia (comportamiento previo)', () => {
    expect(rankedSkyEmoji({ descripcionClima: 'lluvia ligera', iconoClima: '10d' })).toBe(RAIN);
  });
});
