import { describe, it, expect } from 'vitest';
import {
  hayLluviaEnTexto,
  buildRainForecastSignal,
  horaMadrid,
  textosRestantesHoy,
} from '../domain/use-cases/RainForecast';
import type { RainNowcast, RainUpcoming } from '../domain/entities/RainNowcast';
import type { DayForecast } from '../domain/entities/BeachForecast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRain(upcoming: RainUpcoming | null): RainNowcast {
  return {
    status: 'dry',
    precipitationMm: null,
    lastHourOnly: false,
    sources: [],
    timestamp: 1750000000000,
    upcoming,
  };
}

function makeDay(morningSky: string | null, afternoonSky: string | null): DayForecast {
  const half = (sky: string | null) => ({
    skyDescription: sky,
    skyIconCode: null,
    wind: null,
    waves: null,
  });
  return {
    date: 'miércoles 15',
    morning: half(morningSky),
    afternoon: half(afternoonSky),
    maxTemperatureC: 25,
    thermalSensation: null,
    waterTemperatureC: 23,
    uvIndexMax: 8,
    uvLevel: null,
    warning: null,
  };
}

// En julio Madrid es CEST (UTC+2): 09:00Z = 11:00 Madrid; 14:00Z = 16:00 Madrid.
const MANANA_MADRID = new Date('2026-07-15T09:00:00Z');
const TARDE_MADRID = new Date('2026-07-15T14:00:00Z');

// ---------------------------------------------------------------------------
// hayLluviaEnTexto
// ---------------------------------------------------------------------------

describe('hayLluviaEnTexto', () => {
  it('detecta el vocabulario AEMET de precipitación', () => {
    for (const t of ['Chubascos', 'chubascos tormentosos', 'Intervalos nubosos con lluvia', 'Llovizna', 'Tormenta']) {
      expect(hayLluviaEnTexto(t)).toBe(true);
    }
  });

  it('no dispara con cielos sin precipitación ni con vacíos', () => {
    for (const t of ['Despejado', 'Muy nuboso', 'Niebla', '', null, undefined]) {
      expect(hayLluviaEnTexto(t)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// horaMadrid / textosRestantesHoy
// ---------------------------------------------------------------------------

describe('horaMadrid', () => {
  it('convierte a hora de Madrid (CEST en verano)', () => {
    expect(horaMadrid(MANANA_MADRID)).toBe(11);
    expect(horaMadrid(TARDE_MADRID)).toBe(16);
  });
});

describe('textosRestantesHoy', () => {
  const day = makeDay('Nuboso', 'Chubascos');

  it('antes de las 14h Madrid cuenta mañana y tarde', () => {
    expect(textosRestantesHoy(day, MANANA_MADRID)).toEqual(['Nuboso', 'Chubascos']);
  });

  it('a partir de las 14h Madrid solo cuenta la tarde (la lluvia matinal ya pasó)', () => {
    expect(textosRestantesHoy(day, TARDE_MADRID)).toEqual(['Chubascos']);
  });

  it('tolera medios-días sin texto y día ausente', () => {
    expect(textosRestantesHoy(makeDay(null, 'Despejado'), MANANA_MADRID)).toEqual(['Despejado']);
    expect(textosRestantesHoy(null, MANANA_MADRID)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildRainForecastSignal
// ---------------------------------------------------------------------------

describe('buildRainForecastSignal', () => {
  const UPCOMING_RAIN: RainUpcoming = { expected: true, firstAt: 1750003600000, mmMax: 0.6 };
  const UPCOMING_DRY: RainUpcoming = { expected: false, firstAt: null, mmMax: null };

  it('solo Open-Meteo: expected con hora estimada y fuente OpenMeteo', () => {
    const s = buildRainForecastSignal(makeRain(UPCOMING_RAIN), ['Despejado']);
    expect(s).toEqual({
      expected: true,
      firstAt: 1750003600000,
      mmMax: 0.6,
      sources: ['OpenMeteo'],
    });
  });

  it('solo texto AEMET: expected sin hora (firstAt null) y fuente AEMET', () => {
    const s = buildRainForecastSignal(makeRain(UPCOMING_DRY), ['Chubascos']);
    expect(s).toEqual({ expected: true, firstAt: null, mmMax: null, sources: ['AEMET'] });
  });

  it('ambas fuentes disparan: hora de Open-Meteo y las dos fuentes listadas', () => {
    const s = buildRainForecastSignal(makeRain(UPCOMING_RAIN), ['Chubascos tormentosos']);
    expect(s?.expected).toBe(true);
    expect(s?.firstAt).toBe(1750003600000);
    expect(s?.sources).toEqual(['OpenMeteo', 'AEMET']);
  });

  it('ambas negativas → expected false con fuentes vacías', () => {
    const s = buildRainForecastSignal(makeRain(UPCOMING_DRY), ['Despejado']);
    expect(s).toEqual({ expected: false, firstAt: null, mmMax: null, sources: [] });
  });

  it('sin señal alguna (nowcast sin tramos y sin textos) → null', () => {
    expect(buildRainForecastSignal(makeRain(null), [])).toBeNull();
    expect(buildRainForecastSignal(null, [null, undefined])).toBeNull();
  });

  it('nowcast caído pero texto disponible → evalúa solo el texto', () => {
    const s = buildRainForecastSignal(null, ['Intervalos nubosos con lluvia escasa']);
    expect(s?.expected).toBe(true);
    expect(s?.sources).toEqual(['AEMET']);
  });
});
