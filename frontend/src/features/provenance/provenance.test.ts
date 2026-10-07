import {
  normalizeInstant,
  formatAbsoluteInstant,
  weatherSourceName,
  observationProvenance,
  hourlyForecastProvenance,
} from './provenance';
import type { CurrentConditions } from '../../services/api';

describe('normalizeInstant', () => {
  it('parses an ISO string to epoch ms', () => {
    expect(normalizeInstant('2026-08-02T10:00:00.000Z')).toBe(
      Date.UTC(2026, 7, 2, 10, 0, 0)
    );
  });

  it('passes epoch milliseconds through', () => {
    expect(normalizeInstant(1754120000000)).toBe(1754120000000);
  });

  it('returns null for garbage, empty, null and undefined — never an invented instant', () => {
    expect(normalizeInstant('no es una fecha')).toBeNull();
    expect(normalizeInstant('')).toBeNull();
    expect(normalizeInstant(null)).toBeNull();
    expect(normalizeInstant(undefined)).toBeNull();
    expect(normalizeInstant(NaN)).toBeNull();
  });
});

describe('formatearInstanteAbsoluto', () => {
  // 11:30 UTC in January = 12:30 in Madrid (CET): the absolute label must be
  // in the beaches' timezone, not the device's.
  const january = Date.UTC(2026, 0, 15, 11, 30);

  it('formats in Europe/Madrid for Spanish', () => {
    const text = formatAbsoluteInstant(january, 'es');
    expect(text).toContain('12:30');
    expect(text).toContain('2026');
  });

  it('formats in Europe/Madrid for English', () => {
    const text = formatAbsoluteInstant(january, 'en');
    expect(text).toContain('12:30');
    expect(text).toContain('Jan');
  });
});

describe('weatherSourceName', () => {
  it('collapses AEMET transport variants into the public name', () => {
    expect(weatherSourceName('AEMET_XML')).toBe('AEMET');
    expect(weatherSourceName('AEMET_HTML')).toBe('AEMET');
  });

  it('leaves other sources untouched', () => {
    expect(weatherSourceName('OpenWeatherMap')).toBe('OpenWeatherMap');
  });
});

const OBSERVATION: CurrentConditions = {
  cielo: 'Despejado',
  icono: 1,
  temperatura: 24,
  precipitacionMm: null,
  fuente: 'OpenWeather',
  timestamp: '2026-08-02T10:00:00.000Z',
};

describe('observationProvenance', () => {
  it('credits the provider and the capture instant', () => {
    expect(observationProvenance(OBSERVATION)).toEqual({
      kind: 'directo',
      source: 'OpenWeather',
      instantMs: Date.UTC(2026, 7, 2, 10, 0, 0),
    });
  });

  it('keeps the source with a broken timestamp instead of inventing one', () => {
    const noDate = observationProvenance({ ...OBSERVATION, timestamp: 'basura' });
    expect(noDate).toEqual({ kind: 'directo', source: 'OpenWeather', instantMs: null });
  });

  it('returns null with no observation or with nothing to credit', () => {
    expect(observationProvenance(null)).toBeNull();
    expect(observationProvenance(undefined)).toBeNull();
    expect(
      observationProvenance({ ...OBSERVATION, fuente: '' as never, timestamp: 'basura' })
    ).toBeNull();
  });
});

describe('hourlyForecastProvenance', () => {
  it('is a forecast with a source and, honestly, no emission time', () => {
    expect(hourlyForecastProvenance('Open-Meteo')).toEqual({
      kind: 'prevision',
      source: 'Open-Meteo',
      instantMs: null,
    });
  });

  it('returns null without a credited source', () => {
    expect(hourlyForecastProvenance(null)).toBeNull();
    expect(hourlyForecastProvenance(undefined)).toBeNull();
    expect(hourlyForecastProvenance('')).toBeNull();
  });
});
