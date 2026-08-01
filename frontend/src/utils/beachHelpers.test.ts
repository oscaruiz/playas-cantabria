import {
  dentroDeHorario,
  estadoBandera,
  ultimaBanderaRegistrada,
  esInfoReciente,
  formatearHaceTiempo,
  esLluviaActiva,
  horaLocalMadrid,
  lluviaPrevista,
  claveCoberturaWebcam,
  webcamDisponible,
  vigilanciaDisponible,
  coincidePlaya,
  normalizarBusqueda,
  emojiCielo,
  operadorVigilancia,
} from './beachHelpers';

// During the bathing season, Madrid is CEST (UTC+2): UTC + 2h = Madrid time.
const cruzRoja = {
  horario: '11:30 - 19:30',
  coberturaDesde: '12-06-2026',
  coberturaHasta: '15-09-2026',
};

describe('dentroDeHorario', () => {
  it('true dentro del horario (hora de Madrid)', () => {
    // 12:00 UTC = 14:00 Madrid → within 11:30-19:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T12:00:00Z'))).toBe(true);
  });

  it('false antes del izado de las 11:30', () => {
    // 08:00 UTC = 10:00 Madrid → before 11:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T08:00:00Z'))).toBe(false);
  });

  it('false tras el cierre de las 19:30', () => {
    // 18:00 UTC = 20:00 Madrid → after 19:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T18:00:00Z'))).toBe(false);
  });

  it('false fuera de temporada aunque sea media tarde', () => {
    // Oct 1 14:00 Madrid → after coberturaHasta (15-09)
    expect(dentroDeHorario(cruzRoja, new Date('2026-10-01T12:00:00Z'))).toBe(false);
  });

  it('null si no hay horario', () => {
    expect(dentroDeHorario({ horario: null })).toBeNull();
    expect(dentroDeHorario(undefined)).toBeNull();
  });
});

describe('estadoBandera', () => {
  it("'color' cuando hay bandera real izada", () => {
    expect(estadoBandera({ ...cruzRoja, bandera: 'Verde' }, new Date('2026-06-22T12:00:00Z'))).toBe('color');
  });

  it("'fueraDeHorario' sin bandera y fuera del horario", () => {
    expect(estadoBandera({ ...cruzRoja, bandera: 'Desconocida' }, new Date('2026-06-22T08:00:00Z'))).toBe(
      'fueraDeHorario'
    );
  });

  it("'sinDatos' sin bandera pero dentro del horario (captura pendiente)", () => {
    expect(estadoBandera({ ...cruzRoja, bandera: 'Desconocida' }, new Date('2026-06-22T12:00:00Z'))).toBe(
      'sinDatos'
    );
  });

  it("'sinDatos' cuando no se conoce el horario", () => {
    expect(estadoBandera({ bandera: 'Desconocida' })).toBe('sinDatos');
  });

  it("'color' con bandera reciente dentro del horario", () => {
    expect(
      estadoBandera(
        { ...cruzRoja, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBe('color');
  });

  it("'color' con bandera de ayer tarde vista hoy a mediodía (≤24h, franja mañanera)", () => {
    // Regression: the cron captured green yesterday 18:35 Madrid (16:35Z); today at 11:45
    // Madrid (09:45Z) it is the freshest available and we are within hours → it is shown.
    expect(
      estadoBandera(
        { ...cruzRoja, bandera: 'Verde', ultimaActualizacion: '2026-06-21T16:35:00Z' },
        new Date('2026-06-22T09:45:00Z')
      )
    ).toBe('color');
  });

  it("'sinDatos' con bandera de hace más de 24h aunque sea dentro del horario (frescura)", () => {
    expect(
      estadoBandera(
        { ...cruzRoja, bandera: 'Verde', ultimaActualizacion: '2026-06-21T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z') // 27h later
      )
    ).toBe('sinDatos');
  });

  it("'fueraDeHorario' aunque haya bandera de hoy, si es de noche", () => {
    expect(
      estadoBandera(
        { ...cruzRoja, bandera: 'Verde', ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T18:00:00Z') // 20:00 Madrid
      )
    ).toBe('fueraDeHorario');
  });
});

describe('ultimaBanderaRegistrada', () => {
  const verde = { ...cruzRoja, bandera: 'Verde' };

  it('acota la captura posterior al cierre a las 19:30 de ese mismo día', () => {
    // Scraped at 23:00 Madrid (21:00Z): Cruz Roja keeps publishing the page,
    // but the flag stopped flying at 19:30 → that is the time that gets shown.
    const r = ultimaBanderaRegistrada(
      { ...verde, ultimaActualizacion: '2026-06-22T21:00:00Z' },
      new Date('2026-06-22T21:05:00Z')
    );
    expect(r?.bandera).toBe('Verde');
    expect(r?.registradaIso).toBe('2026-06-22T17:30:00.000Z'); // 19:30 Madrid
  });

  it('antes del izado, la última bandera es la del cierre de ayer', () => {
    // 09:00 Madrid (07:00Z), capture from that early morning → closed yesterday at 19:30.
    const r = ultimaBanderaRegistrada(
      { ...verde, ultimaActualizacion: '2026-06-22T05:00:00Z' },
      new Date('2026-06-22T07:00:00Z')
    );
    expect(r?.registradaIso).toBe('2026-06-21T17:30:00.000Z');
  });

  it('conserva la hora exacta si la captura fue dentro del horario', () => {
    const r = ultimaBanderaRegistrada(
      { ...verde, ultimaActualizacion: '2026-06-22T16:00:00Z' }, // 18:00 Madrid
      new Date('2026-06-22T18:00:00Z') // 20:00 Madrid, already closed
    );
    expect(r?.registradaIso).toBe('2026-06-22T16:00:00.000Z');
  });

  it('null dentro de horario (ahí manda la bandera vigente)', () => {
    expect(
      ultimaBanderaRegistrada(
        { ...verde, ultimaActualizacion: '2026-06-22T09:00:00Z' },
        new Date('2026-06-22T12:00:00Z')
      )
    ).toBeNull();
  });

  it('null si el registro tiene más de 36h', () => {
    expect(
      ultimaBanderaRegistrada(
        { ...verde, ultimaActualizacion: '2026-06-20T16:00:00Z' }, // 18:00 Madrid on the 20th
        new Date('2026-06-22T07:00:00Z') // 09:00 Madrid on the 22nd → 39h
      )
    ).toBeNull();
  });

  it('null fuera de temporada y sin bandera con color', () => {
    expect(
      ultimaBanderaRegistrada(
        { ...verde, ultimaActualizacion: '2026-09-16T16:00:00Z' },
        new Date('2026-09-16T18:00:00Z') // coberturaHasta (15-09) already passed
      )
    ).toBeNull();
    expect(
      ultimaBanderaRegistrada(
        { ...cruzRoja, bandera: 'Desconocida', ultimaActualizacion: '2026-06-22T16:00:00Z' },
        new Date('2026-06-22T18:00:00Z')
      )
    ).toBeNull();
  });
});

describe('esInfoReciente', () => {
  const ahora = new Date('2026-06-22T12:00:00Z'); // 14:00 Madrid, on the 22nd

  it('true si la captura tiene ≤24h', () => {
    expect(esInfoReciente('2026-06-22T09:00:00Z', ahora)).toBe(true); // 3h
    expect(esInfoReciente('2026-06-21T16:00:00Z', ahora)).toBe(true); // 20h
  });

  it('false si la captura tiene más de 24h', () => {
    expect(esInfoReciente('2026-06-21T09:00:00Z', ahora)).toBe(false); // 27h
  });

  it('true (lenient) si el ISO no parsea', () => {
    expect(esInfoReciente('no-es-fecha', ahora)).toBe(true);
  });
});

describe('webcamDisponible', () => {
  it('true solo si hay webcam y no está desactivada', () => {
    expect(webcamDisponible({ estado: 'activa' })).toBe(true);
    expect(webcamDisponible({})).toBe(true);
    expect(webcamDisponible({ estado: 'desactivada' })).toBe(false);
    expect(webcamDisponible(null)).toBe(false);
    expect(webcamDisponible(undefined)).toBe(false);
  });
});

describe('claveCoberturaWebcam', () => {
  it('mapea cada cobertura a su clave i18n', () => {
    expect(claveCoberturaWebcam('exacta')).toBe('webcam.enDirecto');
    expect(claveCoberturaWebcam('compartida')).toBe('webcam.vistaPanoramica');
    expect(claveCoberturaWebcam('cercana')).toBe('webcam.cercana');
  });
});

describe('formatearHaceTiempo', () => {
  const t = ((clave: string, vars?: { n: number }) =>
    vars ? `${clave}|${vars.n}` : clave) as unknown as Parameters<typeof formatearHaceTiempo>[1];

  it('ahora mismo, minutos, horas y días', () => {
    expect(formatearHaceTiempo(Date.now(), t)).toBe('tiempo.ahoraMismo');
    expect(formatearHaceTiempo(Date.now() - 5 * 60000 - 100, t)).toBe('tiempo.haceMin|5');
    expect(formatearHaceTiempo(Date.now() - 3 * 3600000 - 1000, t)).toBe('tiempo.haceHoras|3');
    expect(formatearHaceTiempo(Date.now() - 2 * 86400000 - 1000, t)).toBe('tiempo.haceDias|2');
  });

  it('acepta ISO y devuelve "" si no parsea', () => {
    expect(formatearHaceTiempo('no-es-fecha', t)).toBe('');
  });
});

describe('esLluviaActiva', () => {
  it('true con la señal estructurada del backend (multi-fuente)', () => {
    expect(
      esLluviaActiva({ cielo: 'muy nuboso', precipitacionMm: null, lluvia: { estado: 'lloviendo' } })
    ).toBe(true);
  });

  it('la señal estructurada "sin_lluvia" es autoritativa (ignora el regex del cielo)', () => {
    // The nowcast already aggregates all the sources; if it says dry, don't contradict it.
    expect(
      esLluviaActiva({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })
    ).toBe(false);
  });

  it('fallback por mm observados cuando no hay señal estructurada', () => {
    expect(esLluviaActiva({ cielo: 'muy nuboso', precipitacionMm: 0.3 })).toBe(true);
    expect(esLluviaActiva({ cielo: 'muy nuboso', precipitacionMm: 0 })).toBe(false);
  });

  it('fallback por regex sobre el texto del cielo (backends antiguos)', () => {
    expect(esLluviaActiva({ cielo: 'lluvia ligera', precipitacionMm: null })).toBe(true);
    expect(esLluviaActiva({ cielo: 'chubascos tormentosos', precipitacionMm: null })).toBe(true);
    expect(esLluviaActiva({ cielo: 'despejado', precipitacionMm: null })).toBe(false);
  });

  it('con estado desconocido cae a los fallbacks', () => {
    expect(
      esLluviaActiva({ cielo: 'llovizna', precipitacionMm: null, lluvia: { estado: 'desconocido' } })
    ).toBe(true);
  });

  it('false sin datos', () => {
    expect(esLluviaActiva(null)).toBe(false);
    expect(esLluviaActiva(undefined)).toBe(false);
  });
});

describe('horaLocalMadrid', () => {
  it('convierte un ISO UTC a HH:MM de Madrid (CEST en verano)', () => {
    expect(horaLocalMadrid('2026-07-15T14:30:00Z')).toBe('16:30');
  });

  it('null con entradas inválidas o vacías', () => {
    expect(horaLocalMadrid('no-es-fecha')).toBeNull();
    expect(horaLocalMadrid(null)).toBeNull();
    expect(horaLocalMadrid(undefined)).toBeNull();
  });
});

describe('lluviaPrevista', () => {
  const prevista = { desdeIso: '2026-07-15T16:30:00Z', mm: 0.6, fuentes: ['OpenMeteo'] };

  it('devuelve la previsión cuando no llueve todavía', () => {
    expect(
      lluviaPrevista({ cielo: 'muy nuboso', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia', prevista } })
    ).toEqual(prevista);
  });

  it('null si ya está lloviendo (el badge de lluvia activa tiene prioridad)', () => {
    expect(
      lluviaPrevista({ cielo: 'lluvia ligera', precipitacionMm: 0.3, lluvia: { estado: 'lloviendo', prevista } })
    ).toBeNull();
  });

  it('null sin señal de previsión o sin datos', () => {
    expect(lluviaPrevista({ cielo: 'despejado', precipitacionMm: 0, lluvia: { estado: 'sin_lluvia' } })).toBeNull();
    expect(lluviaPrevista(null)).toBeNull();
  });
});

describe('normalizarBusqueda', () => {
  it('minúsculas y sin tildes', () => {
    expect(normalizarBusqueda('Arnía')).toBe('arnia');
    expect(normalizarBusqueda('TRENGANDÍN')).toBe('trengandin');
    expect(normalizarBusqueda('Mataleñas')).toBe('matalenas');
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
    expect(coincidePlaya(arnia, 'arnia')).toBe(true);
    expect(coincidePlaya(arnia, 'Arní')).toBe(true);
  });

  it('encuentra por municipio', () => {
    expect(coincidePlaya(arnia, 'piélagos')).toBe(true);
  });

  it('encuentra por alias (topónimo / puesto)', () => {
    expect(coincidePlaya(gerra, 'gerra')).toBe(true);
    expect(coincidePlaya(gerra, 'bederna')).toBe(true);
  });

  it('no coincide con términos ajenos', () => {
    expect(coincidePlaya(arnia, 'sardinero')).toBe(false);
  });

  it('sin alias no rompe', () => {
    expect(coincidePlaya({ nombre: 'Somo', municipio: 'Ribamontán al Mar' }, 'somo')).toBe(true);
  });
});

describe('vigilanciaDisponible', () => {
  it('usa el operador explícito para proveedores que no son Cruz Roja', () => {
    expect(vigilanciaDisponible({ fuenteBanderas: 'DYA', idCruzRoja: 0 })).toBe(true);
  });

  it('respeta el null explícito aunque queden campos legados', () => {
    expect(vigilanciaDisponible({
      fuenteBanderas: null,
      idCruzRoja: 482,
      cruzRojaStations: [{ id: 373 }],
    })).toBe(false);
  });

  it('detecta el idCruzRoja de compatibilidad', () => {
    expect(vigilanciaDisponible({ idCruzRoja: 482 })).toBe(true);
  });

  it('detecta los puestos aunque no haya idCruzRoja', () => {
    // Case of La Concha in the fallback's raw JSON: stations only.
    expect(vigilanciaDisponible({ cruzRojaStations: [{ id: 373 }, { id: 820 }] })).toBe(true);
  });

  it('detecta los puestos aunque el idCruzRoja venga a 0', () => {
    // Case of the DTO when the backend could not derive the id.
    expect(vigilanciaDisponible({ idCruzRoja: 0, cruzRojaStations: [{ id: 373 }] })).toBe(true);
  });

  it('no cuenta un puesto sin id verificado', () => {
    expect(vigilanciaDisponible({ idCruzRoja: 0, cruzRojaStations: [{}] })).toBe(false);
  });

  it('no cuenta un puesto con id 0', () => {
    expect(vigilanciaDisponible({ cruzRojaStations: [{ id: 0 }] })).toBe(false);
  });

  it('sin ninguna fuente es falso', () => {
    expect(vigilanciaDisponible({ idCruzRoja: 0 })).toBe(false);
    expect(vigilanciaDisponible({})).toBe(false);
    expect(vigilanciaDisponible(undefined)).toBe(false);
    expect(vigilanciaDisponible(null)).toBe(false);
  });
});

describe('emojiCielo', () => {
  // The emojis are written escaped, just like in beachHelpers.ts, so that
  // the file doesn't depend on how each editor represents the modifiers.
  const SOL = '\u2600\uFE0F';
  const SOL_NUBE = '\u{1F324}\uFE0F';
  const NUBE_SOL = '\u26C5';
  const NUBES = '\u2601\uFE0F';
  const TORMENTA = '\u26C8\uFE0F';
  const LLUVIA = '\u{1F327}\uFE0F';
  const NIEVE = '\u{1F328}\uFE0F';
  const NIEBLA = '\u{1F32B}\uFE0F';

  it('da sol para el despejado de las dos fuentes', () => {
    // OpenWeather says "cielo claro" (01x) where AEMET says "despejado".
    expect(emojiCielo('cielo claro')).toBe(SOL);
    expect(emojiCielo('Despejado')).toBe(SOL);
    expect(emojiCielo('cielo despejado')).toBe(SOL);
    expect(emojiCielo('soleado')).toBe(SOL);
  });

  it('da sol entre nubes para las coberturas parciales', () => {
    expect(emojiCielo('poco nuboso')).toBe(SOL_NUBE);
    expect(emojiCielo('Intervalos nubosos')).toBe(SOL_NUBE);
    expect(emojiCielo('nubes dispersas')).toBe(SOL_NUBE);
    expect(emojiCielo('algo de nubes')).toBe(SOL_NUBE);
    // 'parcial' beats 'soleado', which would otherwise take it entirely.
    expect(emojiCielo('parcialmente soleado')).toBe(SOL_NUBE);
  });

  it('distingue el cubierto del nuboso', () => {
    expect(emojiCielo('muy nuboso')).toBe(NUBES);
    expect(emojiCielo('cubierto')).toBe(NUBES);
    // Plain 'nubes' is OpenWeather's 04x, which is overcast.
    expect(emojiCielo('nubes')).toBe(NUBES);
    expect(emojiCielo('nuboso')).toBe(NUBE_SOL);
    expect(emojiCielo('cielo nublado')).toBe(NUBE_SOL);
  });

  it('la precipitación gana a la cobertura en los estados combinados de AEMET', () => {
    // Before, the cloud or the sun came out and the rain got lost entirely.
    expect(emojiCielo('Cubierto con lluvia')).toBe(LLUVIA);
    expect(emojiCielo('Cubierto con lluvia escasa')).toBe(LLUVIA);
    expect(emojiCielo('Intervalos nubosos con lluvia')).toBe(LLUVIA);
    expect(emojiCielo('Intervalos nubosos con lluvia escasa')).toBe(LLUVIA);
    expect(emojiCielo('Muy nuboso con nieve')).toBe(NIEVE);
    expect(emojiCielo('Nuboso con tormenta')).toBe(TORMENTA);
  });

  it('cubre el resto de fenómenos', () => {
    expect(emojiCielo('lluvia ligera')).toBe(LLUVIA);
    expect(emojiCielo('llovizna')).toBe(LLUVIA);
    expect(emojiCielo('chubascos')).toBe(LLUVIA);
    expect(emojiCielo('tormenta')).toBe(TORMENTA);
    // 'tormentosos' does not contain 'tormenta'; that's why the pattern is 'torment'.
    expect(emojiCielo('chubascos tormentosos')).toBe(TORMENTA);
    expect(emojiCielo('nieve')).toBe(NIEVE);
    expect(emojiCielo('niebla')).toBe(NIEBLA);
    expect(emojiCielo('bruma')).toBe(NIEBLA);
  });

  it('cae al genérico sin dato o sin reconocer', () => {
    expect(emojiCielo(null)).toBe(NUBE_SOL);
    expect(emojiCielo('')).toBe(NUBE_SOL);
    expect(emojiCielo('vete a saber')).toBe(NUBE_SOL);
  });
});

describe('operadorVigilancia', () => {
  it('devuelve el operador que informa el backend', () => {
    expect(operadorVigilancia({ fuenteBanderas: 'DYA' })).toBe('DYA');
  });

  it('devuelve null cuando el backend dice que no hay servicio', () => {
    expect(operadorVigilancia({ fuenteBanderas: null })).toBeNull();
  });

  it('distingue "no hay servicio" de "el backend no lo informa"', () => {
    // The local fallback catalog and the backend deployed before this feature
    // carry no field at all: they must keep showing what they always showed.
    expect(operadorVigilancia({})).toBe('Cruz Roja');
    expect(operadorVigilancia(undefined)).toBe('Cruz Roja');
  });
});
