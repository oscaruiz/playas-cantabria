import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { corregirCieloObservado } from '../application/services/skyCorrectionRunner';
import { skyCorrectionMetrics } from '../infrastructure/observability/skyCorrectionMetrics';
import { Weather } from '../domain/entities/Weather';
import { SunshineObservation } from '../domain/entities/Sunshine';

/** 29-jul 12:00 UTC = 14:00 Madrid time: inside the beach time slot. */
const EN_FRANJA = Date.parse('2026-07-29T12:00:00.000Z');
/** 29-jul 04:00 UTC = 06:00 Madrid time: outside. */
const FUERA_DE_FRANJA = Date.parse('2026-07-29T04:00:00.000Z');

const DESPEJADO: Weather = {
  source: 'OpenWeather',
  timestamp: EN_FRANJA,
  temperatureC: 25.7,
  description: 'cielo claro',
  icon: '01d',
  conditionCode: 800,
  precipitationMm: null,
  windSpeedMs: 3,
  windDirectionDeg: 310,
  humidityPct: 79,
  pressureHPa: 1018,
};

const SIN_SOL: SunshineObservation[] = [
  {
    insoMin: 0,
    fraccion: 0,
    distanciaKm: 5,
    idema: '1111X',
    ubicacion: 'SANTANDER CMT',
    observadoEn: EN_FRANJA - 10 * 60 * 1000,
  },
];

const SOL_SOSTENIDO: SunshineObservation[] = [
  {
    insoMin: 55,
    fraccion: 55 / 60,
    distanciaKm: 20,
    idema: '1111X',
    ubicacion: 'SANTANDER CMT',
    observadoEn: EN_FRANJA - 10 * 60 * 1000,
  },
];

const original = process.env.SKY_CORRECTION;

beforeEach(() => skyCorrectionMetrics.reset());
afterEach(() => {
  if (original === undefined) delete process.env.SKY_CORRECTION;
  else process.env.SKY_CORRECTION = original;
});

describe('corregirCieloObservado — modos', () => {
  it('shadow: NO cambia la salida, pero sí la registra', () => {
    process.env.SKY_CORRECTION = 'shadow';
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, EN_FRANJA);

    expect(res).toBe(DESPEJADO); // the very same object: the API never notices
    const snap = skyCorrectionMetrics.snapshot();
    expect(snap.motivos).toEqual({ corregido: 1 });
    expect(snap.corregidas.map((c) => c.playa)).toEqual(['Sardinero']);
  });

  it('sin env puesta corrige: "on" es el modo por defecto', () => {
    delete process.env.SKY_CORRECTION;
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, EN_FRANJA);
    expect(res?.description).toBe('muy nuboso');
  });

  it('on: aplica la corrección', () => {
    process.env.SKY_CORRECTION = 'on';
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, EN_FRANJA);

    expect(res?.description).toBe('muy nuboso');
    expect(res?.icon).toBe('04d');
    expect(res?.source).toBe('OpenWeather');
    expect(res?.temperatureC).toBe(DESPEJADO.temperatureC);
  });

  it('on: mejora a despejado cuando la insolación cercana contradice las nubes', () => {
    process.env.SKY_CORRECTION = 'on';
    const nublado = { ...DESPEJADO, description: 'muy nuboso', icon: '04d' };
    const res = corregirCieloObservado('La Concha', nublado, SOL_SOSTENIDO, false, EN_FRANJA);

    expect(res?.description).toBe('cielo claro');
    expect(res?.icon).toBe('01d');
    expect(res?.source).toBe('OpenWeather');
  });

  it('on: usa solo una previsión horaria inmediata para corroborar sol moderado', () => {
    process.env.SKY_CORRECTION = 'on';
    const nublado = { ...DESPEJADO, description: 'nubes', icon: '04d' };
    const solModerado = [{ ...SOL_SOSTENIDO[0], insoMin: 33, fraccion: 0.55 }];
    const inmediata = [{
      timestamp: EN_FRANJA + 30 * 60 * 1000,
      cloudCoverPct: 0,
      temperatureC: 24,
      windSpeedMs: 3,
    }];

    expect(
      corregirCieloObservado('La Concha', nublado, solModerado, false, EN_FRANJA, inmediata)
        ?.description,
    ).toBe('cielo claro');

    const lejana = [{ ...inmediata[0], timestamp: EN_FRANJA + 2 * 60 * 60 * 1000 }];
    expect(
      corregirCieloObservado('La Concha', nublado, solModerado, false, EN_FRANJA, lejana),
    ).toBe(nublado);
  });

  it('off: ni calcula ni registra', () => {
    process.env.SKY_CORRECTION = 'off';
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, EN_FRANJA);

    expect(res).toBe(DESPEJADO);
    expect(skyCorrectionMetrics.snapshot().total).toBe(0);
  });

  it('un valor raro en la env cae al defecto (on), no deja el corrector mudo', () => {
    // Turning it off has to be deliberate: only exact "shadow" or "off" stop it.
    // A typo in the variable must not leave the app saying "sun" under an
    // overcast sky without anyone noticing.
    process.env.SKY_CORRECTION = 'OFF_PLEASE';
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, EN_FRANJA);
    expect(res?.description).toBe('muy nuboso');
  });
});

describe('corregirCieloObservado — franja horaria', () => {
  it('fuera de la franja de playa no corrige ni con on', () => {
    process.env.SKY_CORRECTION = 'on';
    const res = corregirCieloObservado('Sardinero', DESPEJADO, SIN_SOL, false, FUERA_DE_FRANJA);

    expect(res).toBe(DESPEJADO);
    expect(skyCorrectionMetrics.snapshot().motivos).toEqual({ 'fuera-de-franja': 1 });
  });
});

describe('corregirCieloObservado — sin datos', () => {
  it('sin weather devuelve null sin romper', () => {
    process.env.SKY_CORRECTION = 'on';
    expect(corregirCieloObservado('Sardinero', null, SIN_SOL, false, EN_FRANJA)).toBeNull();
  });

  it('sin observaciones deja el dato del modelo intacto', () => {
    process.env.SKY_CORRECTION = 'on';
    expect(corregirCieloObservado('Sardinero', DESPEJADO, [], false, EN_FRANJA)).toBe(DESPEJADO);
  });
});
