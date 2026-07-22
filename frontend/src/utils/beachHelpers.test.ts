import {
  dentroDeHorario,
  estadoBandera,
  esInfoReciente,
  formatearHaceTiempo,
  esLluviaActiva,
  horaLocalMadrid,
  lluviaPrevista,
} from './beachHelpers';

// Durante la temporada de baño, Madrid es CEST (UTC+2): UTC + 2h = hora Madrid.
const cruzRoja = {
  horario: '11:30 - 19:30',
  coberturaDesde: '12-06-2026',
  coberturaHasta: '15-09-2026',
};

describe('dentroDeHorario', () => {
  it('true dentro del horario (hora de Madrid)', () => {
    // 12:00 UTC = 14:00 Madrid → dentro de 11:30-19:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T12:00:00Z'))).toBe(true);
  });

  it('false antes del izado de las 11:30', () => {
    // 08:00 UTC = 10:00 Madrid → antes de 11:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T08:00:00Z'))).toBe(false);
  });

  it('false tras el cierre de las 19:30', () => {
    // 18:00 UTC = 20:00 Madrid → después de 19:30
    expect(dentroDeHorario(cruzRoja, new Date('2026-06-22T18:00:00Z'))).toBe(false);
  });

  it('false fuera de temporada aunque sea media tarde', () => {
    // 1 oct 14:00 Madrid → después de coberturaHasta (15-09)
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
    // Regresión: el cron capturó verde ayer 18:35 Madrid (16:35Z); hoy a las 11:45
    // Madrid (09:45Z) es lo más fresco disponible y estamos en horario → se muestra.
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
        new Date('2026-06-22T12:00:00Z') // 27h después
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

describe('esInfoReciente', () => {
  const ahora = new Date('2026-06-22T12:00:00Z'); // 14:00 Madrid, día 22

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
    // El nowcast agrega ya todas las fuentes; si dice seco, no contradecirlo.
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
