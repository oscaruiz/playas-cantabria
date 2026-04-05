import { Weather } from '../entities/Weather';
import { FlagStatus, FlagColor } from '../entities/Flag';
import { BeachAttributes } from '../entities/Beach';

/**
 * Minimal enrichment data used by the scorer.
 * Can be derived from AemetBeachForecastProvider or AemetBeachWebScraper.
 */
export interface ForecastEnrichment {
  waves: string | null;
  uvIndex: number | null;
  warningLevel: number | null;
}

// ---------------------------------------------------------------------------
// Sub-score interfaces
// ---------------------------------------------------------------------------

export interface SubScores {
  cielo: number;
  temperatura: number;
  bandera: number;
  viento: number;
  oleaje: number;
  uv: number;
  datos: number;
}

export interface ScoringResult {
  score: number;
  subScores: SubScores;
}

// ---------------------------------------------------------------------------
// Sky score (0-25)
// ---------------------------------------------------------------------------

const ICON_SKY_SCORE: Record<string, number> = {
  '01d': 25, '01n': 25,
  '02d': 22, '02n': 22,
  '03d': 16, '03n': 16,
  '04d': 10, '04n': 10,
  '09d': 3,  '09n': 3,
  '10d': 0,  '10n': 0,
  '11d': 0,  '11n': 0,
  '13d': 0,  '13n': 0,
  '50d': 4,  '50n': 4,
};

function skyScoreFromDescription(desc: string): number {
  const s = desc.toLowerCase();
  if (/(despejado|soleado)/.test(s)) return 25;
  if (/(poco\s*nuboso|intervalos|parcial|claro)/.test(s)) return 20;
  if (/(nuboso|nublado|cubierto|muy nuboso)/.test(s)) return 10;
  if (/(lluvia|chubasc|llovizna)/.test(s)) return 0;
  if (/(tormenta|eléctrica|rayos)/.test(s)) return 0;
  if (/(niebla|bruma|neblina)/.test(s)) return 4;
  if (/(nieve|nevada|aguanieve)/.test(s)) return 0;
  return 8;
}

export function computeSkyScore(weather: Weather | null): number {
  if (!weather) return 8;
  if (weather.icon && ICON_SKY_SCORE[weather.icon] !== undefined) {
    return ICON_SKY_SCORE[weather.icon];
  }
  if (weather.description) {
    return skyScoreFromDescription(weather.description);
  }
  return 8;
}

// ---------------------------------------------------------------------------
// Temperature score (0-20)
// ---------------------------------------------------------------------------

export function computeTemperatureScore(tempC: number | null): number {
  if (tempC == null) return 7;
  if (tempC < 10) return 0;
  if (tempC < 15) return interpolate(tempC, 10, 15, 0, 3);
  if (tempC < 18) return interpolate(tempC, 15, 18, 3, 8);
  if (tempC < 22) return interpolate(tempC, 18, 22, 8, 14);
  if (tempC <= 28) return interpolate(tempC, 22, 28, 14, 20);
  if (tempC <= 33) return interpolate(tempC, 28, 33, 20, 17);
  return interpolate(Math.min(tempC, 40), 33, 40, 17, 12);
}

// ---------------------------------------------------------------------------
// Flag score (0-20)
// ---------------------------------------------------------------------------

const FLAG_SCORE: Record<FlagColor, number> = {
  green: 20,
  yellow: 10,
  red: 0,
  black: 0,
  unknown: 6,
};

export function computeFlagScore(flag: FlagStatus | null): number {
  if (!flag || !flag.color) return 10; // sin cobertura CR → neutral
  return FLAG_SCORE[flag.color] ?? 10;
}

// ---------------------------------------------------------------------------
// Wind score (0-15)
// ---------------------------------------------------------------------------

export function computeWindScore(windSpeedMs: number | null): number {
  if (windSpeedMs == null) return 7;
  if (windSpeedMs <= 3) return 15;
  if (windSpeedMs <= 5) return interpolate(windSpeedMs, 3, 5, 15, 12);
  if (windSpeedMs <= 8) return interpolate(windSpeedMs, 5, 8, 12, 8);
  if (windSpeedMs <= 12) return interpolate(windSpeedMs, 8, 12, 8, 3);
  return interpolate(Math.min(windSpeedMs, 20), 12, 20, 3, 0);
}

// ---------------------------------------------------------------------------
// Waves score (0-10)
// ---------------------------------------------------------------------------

function wavesTextFromWind(windMs: number | null): string | null {
  if (windMs == null) return null;
  const kmh = windMs * 3.6;
  if (kmh > 20) return 'agitado';
  if (kmh > 10) return 'moderado';
  return 'tranquilo';
}

function wavesScoreFromText(text: string): number {
  const s = text.toLowerCase();
  if (/(débil|tranquilo|calm|en calma|llana)/.test(s)) return 10;
  if (/(moderado|marejadilla)/.test(s)) return 6;
  if (/(fuerte|agitado|marejada|gruesa)/.test(s)) return 2;
  if (/(muy fuerte|arbolada|montañosa|enorme)/.test(s)) return 0;
  return 5;
}

export function computeWavesScore(
  enrichment: ForecastEnrichment | null,
  weather: Weather | null,
  isSurfBeach: boolean,
): number {
  let wavesText: string | null = null;

  // Prefer real waves data from forecast enrichment
  if (enrichment?.waves) {
    wavesText = enrichment.waves;
  }

  // Fallback: derive from wind
  if (!wavesText && weather) {
    wavesText = wavesTextFromWind(weather.windSpeedMs);
  }

  if (!wavesText) return 5; // neutral

  const baseScore = wavesScoreFromText(wavesText);

  // Surf beaches: moderate-strong waves are not penalized
  if (isSurfBeach && baseScore < 6) {
    return Math.max(baseScore, 7);
  }

  return baseScore;
}

// ---------------------------------------------------------------------------
// UV score (0-5)
// ---------------------------------------------------------------------------

export function computeUVScore(uvIndex: number | null): number {
  if (uvIndex == null) return 3;
  if (uvIndex <= 5) return 5;
  if (uvIndex <= 7) return 3;
  if (uvIndex <= 10) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Data completeness score (0-5)
// ---------------------------------------------------------------------------

export function computeDataScore(weather: Weather | null, flag: FlagStatus | null): number {
  if (weather && flag) return 5;
  if (weather) return 3;
  if (flag) return 2;
  return 0;
}

// ---------------------------------------------------------------------------
// Exclusion rules
// ---------------------------------------------------------------------------

export function isExcluded(
  weather: Weather | null,
  flag: FlagStatus | null,
  enrichment: ForecastEnrichment | null,
): boolean {
  // Black flag: swimming prohibited
  if (flag?.color === 'black') return true;

  // Red flag + strong wind: dangerous conditions
  if (flag?.color === 'red' && weather?.windSpeedMs != null && weather.windSpeedMs > 12) return true;

  // Active thunderstorm
  if (weather?.icon === '11d' || weather?.icon === '11n') return true;

  // Weather warning level >= 2 (orange/red alert)
  if (enrichment?.warningLevel != null && enrichment.warningLevel >= 2) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Full scoring
// ---------------------------------------------------------------------------

export function computeBeachScore(
  weather: Weather | null,
  flag: FlagStatus | null,
  enrichment: ForecastEnrichment | null,
  attributes?: BeachAttributes,
): ScoringResult {
  const isSurf = attributes?.surf === true;
  const uvIndex = enrichment?.uvIndex ?? null;

  const subScores: SubScores = {
    cielo: computeSkyScore(weather),
    temperatura: computeTemperatureScore(weather?.temperatureC ?? null),
    bandera: computeFlagScore(flag),
    viento: computeWindScore(weather?.windSpeedMs ?? null),
    oleaje: computeWavesScore(enrichment, weather, isSurf),
    uv: computeUVScore(uvIndex),
    datos: computeDataScore(weather, flag),
  };

  const score = subScores.cielo
    + subScores.temperatura
    + subScores.bandera
    + subScores.viento
    + subScores.oleaje
    + subScores.uv
    + subScores.datos;

  return { score, subScores };
}

// ---------------------------------------------------------------------------
// Ranking reason (human-readable)
// ---------------------------------------------------------------------------

export function buildRankingReason(
  subScores: SubScores,
  weather: Weather | null,
  flag: FlagStatus | null,
): string {
  const parts: string[] = [];

  if (subScores.cielo >= 20) parts.push('Sol');
  else if (subScores.cielo >= 15) parts.push('Parcialmente soleado');
  else if (subScores.cielo >= 10) parts.push('Nublado');

  if (weather?.temperatureC != null) parts.push(`${Math.round(weather.temperatureC)}\u00B0`);

  if (subScores.viento >= 12) parts.push('sin viento');
  else if (subScores.viento >= 8) parts.push('brisa suave');

  if (flag?.color === 'green') parts.push('bandera verde');
  else if (flag?.color === 'yellow') parts.push('precauci\u00F3n');

  return parts.join(', ') || 'Condiciones aceptables';
}

// ---------------------------------------------------------------------------
// Caution reason (human-readable, for low-scoring beaches)
// ---------------------------------------------------------------------------

export function buildCautionReason(
  subScores: SubScores,
  weather: Weather | null,
  flag: FlagStatus | null,
): string {
  const parts: string[] = [];

  if (flag?.color === 'red') parts.push('bandera roja');
  else if (flag?.color === 'black') parts.push('ba\u00F1o prohibido');
  else if (flag?.color === 'yellow') parts.push('bandera amarilla');

  if (subScores.viento <= 3) parts.push('viento fuerte');
  if (subScores.oleaje <= 2) parts.push('oleaje fuerte');
  if (subScores.cielo <= 3) parts.push('lluvia o tormenta');
  if (subScores.uv <= 1 && subScores.uv !== 3) parts.push('UV muy alto');
  if (subScores.temperatura <= 3) parts.push('temperatura baja');

  if (parts.length === 0) parts.push('condiciones poco favorables');

  // Capitalize first part
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(', ');
}

/** Reason for excluded beaches (hard-filtered) */
export function buildExclusionReason(
  weather: Weather | null,
  flag: FlagStatus | null,
  enrichment: ForecastEnrichment | null,
): string {
  if (flag?.color === 'black') return 'Ba\u00F1o prohibido (bandera negra)';
  if (flag?.color === 'red' && weather?.windSpeedMs != null && weather.windSpeedMs > 12)
    return 'Bandera roja con viento muy fuerte';
  if (weather?.icon === '11d' || weather?.icon === '11n') return 'Tormenta activa';
  if (enrichment?.warningLevel != null && enrichment.warningLevel >= 2) return 'Alerta meteorol\u00F3gica';
  return 'Condiciones peligrosas';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function interpolate(value: number, minIn: number, maxIn: number, minOut: number, maxOut: number): number {
  const t = (value - minIn) / (maxIn - minIn);
  return Math.round(minOut + t * (maxOut - minOut));
}
