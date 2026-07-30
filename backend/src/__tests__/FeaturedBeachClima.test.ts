import { describe, it, expect } from 'vitest';
import { FeaturedBeachMapper, FeaturedBeachResult } from '../application/mappers/FeaturedBeachMapper';
import { buildRankingReason, ForecastEnrichment, SubScores } from '../domain/use-cases/BeachScorer';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';

// ---------------------------------------------------------------------------
// The map and "Playas recomendadas" render `descripcionClima` (and the ranking
// reason). They used to show the AEMET FORECAST ("Despejado") even though the icon
// and the temperature were already real observation. These tests pin that the sky TEXT
// uses the OpenWeather observation (consistent with the detail's `tiempoActual`).
// ---------------------------------------------------------------------------

const BEACH: Beach = {
  id: '1', name: 'Playa Test', municipality: 'Test', aemetCode: '0001',
  latitude: 43.4, longitude: -4.0,
};

function makeWeather(over: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather', timestamp: 1750000000000, temperatureC: 22,
    description: 'algo de nubes', icon: '02d', precipitationMm: null,
    windSpeedMs: 3, windDirectionDeg: 180, humidityPct: 60, pressureHPa: 1015,
    ...over,
  };
}

function makeEnrichment(over: Partial<ForecastEnrichment> = {}): ForecastEnrichment {
  return { waves: 'tranquilo', uvIndex: 5, warningLevel: null, temperatureC: 24, summary: 'Despejado', wind: 'flojo', ...over };
}

function makeResult(over: Partial<FeaturedBeachResult> = {}): FeaturedBeachResult {
  return {
    beach: BEACH, weather: makeWeather(), flag: null, score: 80,
    reason: '', downgradeReason: null, enrichment: makeEnrichment(), ...over,
  };
}

describe('FeaturedBeachMapper.descripcionClima — observación real con prioridad', () => {
  it('usa la descripción de OpenWeather (observación) en vez de la previsión AEMET', () => {
    const dto = FeaturedBeachMapper.toDTO([makeResult()], [], [makeResult()], 0);
    expect(dto.playas[0].descripcionClima).toBe('algo de nubes'); // not "Despejado"
  });

  it('cae a la previsión AEMET cuando la observación NO es OpenWeather (texto sintético)', () => {
    const aemetObs = makeResult({
      weather: makeWeather({ source: 'AEMET', description: 'Templado y húmedo' }),
    });
    const dto = FeaturedBeachMapper.toDTO([aemetObs], [], [aemetObs], 0);
    expect(dto.playas[0].descripcionClima).toBe('Despejado'); // forecast, not synthetic
  });

  it('el icono y la temperatura siguen siendo observación (coherentes con el texto)', () => {
    const dto = FeaturedBeachMapper.toDTO([makeResult()], [], [makeResult()], 0);
    expect(dto.playas[0].iconoClima).toBe('02d');
    expect(dto.playas[0].temperatura).toBe(22);
  });
});

describe('buildRankingReason — palabra de cielo desde la observación', () => {
  const subScores: SubScores = { cielo: 22, temperatura: 14, bandera: 20, viento: 15, oleaje: 10, uv: 5, datos: 5 };

  it('prefiere la observación OpenWeather sobre enrichment.summary', () => {
    const reason = buildRankingReason(subScores, makeWeather({ description: 'algo de nubes' }), null, makeEnrichment({ summary: 'Despejado' }));
    expect(reason).toContain('Parcialmente soleado'); // from "algo de nubes", not "Sol"
    expect(reason).not.toContain('Sol,');
  });

  it('cae a la previsión cuando la observación es AEMET', () => {
    const reason = buildRankingReason(subScores, makeWeather({ source: 'AEMET', description: 'Templado' }), null, makeEnrichment({ summary: 'Despejado' }));
    expect(reason).toContain('Sol'); // word derived from the "Despejado" forecast
  });

  // "nubes dispersas" is OpenWeather's 03x (25-50% coverage): with half the
  // sky blue it is NOT "Nublado". Only 04x (plain "nubes") is.
  it('"nubes dispersas" es parcialmente soleado, no nublado', () => {
    const reason = buildRankingReason(subScores, makeWeather({ description: 'nubes dispersas', icon: '03d' }), null, makeEnrichment());
    expect(reason).toContain('Parcialmente soleado');
    expect(reason).not.toContain('Nublado');
  });

  it('"nubes" (cubierto, 04x) sigue siendo nublado', () => {
    const reason = buildRankingReason({ ...subScores, cielo: 10 }, makeWeather({ description: 'nubes', icon: '04d' }), null, makeEnrichment());
    expect(reason).toContain('Nublado');
  });
});
