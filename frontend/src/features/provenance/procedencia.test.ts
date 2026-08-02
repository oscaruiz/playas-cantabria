import {
  normalizarInstante,
  formatearInstanteAbsoluto,
  nombreFuenteMeteo,
  procedenciaObservacion,
  procedenciaPrevisionHoras,
} from './procedencia';
import type { TiempoActual } from '../../services/api';

describe('normalizarInstante', () => {
  it('parses an ISO string to epoch ms', () => {
    expect(normalizarInstante('2026-08-02T10:00:00.000Z')).toBe(
      Date.UTC(2026, 7, 2, 10, 0, 0)
    );
  });

  it('passes epoch milliseconds through', () => {
    expect(normalizarInstante(1754120000000)).toBe(1754120000000);
  });

  it('returns null for garbage, empty, null and undefined — never an invented instant', () => {
    expect(normalizarInstante('no es una fecha')).toBeNull();
    expect(normalizarInstante('')).toBeNull();
    expect(normalizarInstante(null)).toBeNull();
    expect(normalizarInstante(undefined)).toBeNull();
    expect(normalizarInstante(NaN)).toBeNull();
  });
});

describe('formatearInstanteAbsoluto', () => {
  // 11:30 UTC in January = 12:30 in Madrid (CET): the absolute label must be
  // in the beaches' timezone, not the device's.
  const enero = Date.UTC(2026, 0, 15, 11, 30);

  it('formats in Europe/Madrid for Spanish', () => {
    const texto = formatearInstanteAbsoluto(enero, 'es');
    expect(texto).toContain('12:30');
    expect(texto).toContain('2026');
  });

  it('formats in Europe/Madrid for English', () => {
    const texto = formatearInstanteAbsoluto(enero, 'en');
    expect(texto).toContain('12:30');
    expect(texto).toContain('Jan');
  });
});

describe('nombreFuenteMeteo', () => {
  it('collapses AEMET transport variants into the public name', () => {
    expect(nombreFuenteMeteo('AEMET_XML')).toBe('AEMET');
    expect(nombreFuenteMeteo('AEMET_HTML')).toBe('AEMET');
  });

  it('leaves other sources untouched', () => {
    expect(nombreFuenteMeteo('OpenWeatherMap')).toBe('OpenWeatherMap');
  });
});

const OBSERVACION: TiempoActual = {
  cielo: 'Despejado',
  icono: 1,
  temperatura: 24,
  precipitacionMm: null,
  fuente: 'OpenWeather',
  timestamp: '2026-08-02T10:00:00.000Z',
};

describe('procedenciaObservacion', () => {
  it('credits the provider and the capture instant', () => {
    expect(procedenciaObservacion(OBSERVACION)).toEqual({
      tipo: 'directo',
      fuente: 'OpenWeather',
      instanteMs: Date.UTC(2026, 7, 2, 10, 0, 0),
    });
  });

  it('keeps the source with a broken timestamp instead of inventing one', () => {
    const sinFecha = procedenciaObservacion({ ...OBSERVACION, timestamp: 'basura' });
    expect(sinFecha).toEqual({ tipo: 'directo', fuente: 'OpenWeather', instanteMs: null });
  });

  it('returns null with no observation or with nothing to credit', () => {
    expect(procedenciaObservacion(null)).toBeNull();
    expect(procedenciaObservacion(undefined)).toBeNull();
    expect(
      procedenciaObservacion({ ...OBSERVACION, fuente: '', timestamp: 'basura' })
    ).toBeNull();
  });
});

describe('procedenciaPrevisionHoras', () => {
  it('is a forecast with a source and, honestly, no emission time', () => {
    expect(procedenciaPrevisionHoras('Open-Meteo')).toEqual({
      tipo: 'prevision',
      fuente: 'Open-Meteo',
      instanteMs: null,
    });
  });

  it('returns null without a credited source', () => {
    expect(procedenciaPrevisionHoras(null)).toBeNull();
    expect(procedenciaPrevisionHoras(undefined)).toBeNull();
    expect(procedenciaPrevisionHoras('')).toBeNull();
  });
});
