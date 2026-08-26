import { Weather } from '../entities/Weather';
import { FlagStatus, FlagColor } from '../entities/Flag';
import { BeachAttributes } from '../entities/Beach';
import { RainNowcast } from '../entities/RainNowcast';
import { RainForecastSignal } from './RainForecast';
// Type-only: `WeatherOutlook` imports the scoring functions from here, and a
// value import would close the cycle at runtime.
import type { OutlookSignal } from './WeatherOutlook';

/**
 * Score cap when rain is detected now: <60 so the beach is never "good"
 * (green) on map/Home, and ≥35 so it stays in the yellow (medium) band and
 * does not drop to red just because of the rain.
 */
export const RAIN_SCORE_CAP = 55;

/**
 * Cap when rain is FORECAST (next ~6h or today per AEMET) but it is not yet
 * raining: also yellow (<60), but above the active-rain cap → hierarchy
 * raining (55) < going to rain (59) < dry.
 */
export const RAIN_FORECAST_SCORE_CAP = 59;

/**
 * How much the next few hours can move the score, up or down. Eight points is
 * enough to cross the green band (a beach at 57 that is clearing reaches 65)
 * and not enough to turn a bad beach into a good one: an hourly global model
 * is wrong often enough on this coast that it does not get to overrule what is
 * actually happening.
 */
export const OUTLOOK_MAX_DELTA = 8;

/** Human-readable fragment for the reasons when rain is detected. */
function rainReasonFragment(rain: RainNowcast | null | undefined): string | null {
  if (rain?.status !== 'raining') return null;
  return rain.lastHourOnly ? 'lluvia en la última hora' : 'lloviendo ahora';
}

/** Human-readable fragment when rain is forecast (no time: it must be
 *  translatable by exact fragment on the client). */
function rainForecastReasonFragment(
  forecast: RainForecastSignal | null | undefined,
): string | null {
  return forecast?.expected ? 'lluvia prevista' : null;
}

/**
 * Fragment for the outlook. Qualitative and WITHOUT an hour on purpose, like
 * the rain one: the client translates these reasons fragment by exact
 * fragment, so "despeja a las 14:00" could not be translated at all.
 */
function outlookReasonFragment(
  outlook: OutlookSignal | null | undefined,
): string | null {
  if (outlook?.direccion === 'mejora') return 'mejora en las próximas horas';
  if (outlook?.direccion === 'empeora') return 'empeora en las próximas horas';
  return null;
}

/**
 * Minimal enrichment data used by the scorer.
 * Can be derived from AemetBeachForecastProvider or AemetBeachWebScraper.
 */
export interface ForecastEnrichment {
  waves: string | null;
  uvIndex: number | null;
  warningLevel: number | null;
  temperatureC?: number | null;
  summary?: string | null;
  wind?: string | null;
}

// ---------------------------------------------------------------------------
// Sub-score interfaces
// ---------------------------------------------------------------------------

/**
 * Public names of the flag operators active in the region. An EMPTY array means
 * the region has no lifeguard-flag service at all, which is not the same as a
 * beach with no station: see `rescaleWithoutFlag`.
 *
 * The default only serves the unit tests, written against Cantabria and its
 * single operator. The HTTP path never falls back to it — `GetFeaturedBeaches`
 * takes the region's operators as a required constructor argument.
 */
export const LEGACY_FLAG_OPERATORS: readonly string[] = ['Cruz Roja'];

/** Weight of the flag factor in the 0-100 total, and the total itself. */
const FLAG_MAX = 10;
const SCORE_MAX = 100;

/**
 * Reachable maximum of each factor. Published in the API so the interface can
 * draw "10/25" and a proportional bar: these are the model's weights, and a
 * copy of them in the frontend would keep drawing the old bar the day one
 * changes.
 */
export const SUBSCORE_MAX = {
  cielo: 25,
  temperatura: 25,
  bandera: FLAG_MAX,
  viento: 25,
  oleaje: 10,
  datos: 5,
} as const;

/**
 * Reachable maximum when the region has no flag service: the flag factor
 * disappears (-10) and `datos` can never award the 2 points that came from
 * having a flag reading (-2).
 */
const SCORE_MAX_WITHOUT_FLAG = SCORE_MAX - FLAG_MAX - 2;

/**
 * Rescales to 0-100 the score of a region with no flag service. Without this
 * every beach in such a region would lose the same ~12 points, and the bands
 * (green ≥60) would read the absence of an operator as bad conditions —
 * penalising the whole region for something that has nothing to do with the
 * beach.
 */
function rescaleWithoutFlag(raw: number): number {
  return Math.round((raw * SCORE_MAX) / SCORE_MAX_WITHOUT_FLAG);
}

export interface SubScores {
  cielo: number;
  temperatura: number;
  bandera: number;
  viento: number;
  oleaje: number;
  datos: number;
  /** Applied outlook delta. Optional: it is a correction, not a seventh factor. */
  pronostico?: number;
}

/** Which cap clipped the score, if any. */
export type ScoreCap = 'lluvia' | 'lluvia_prevista';

export interface ScoringResult {
  score: number;
  subScores: SubScores;
  /**
   * Reported because it is the reason the factors do not add up to the score.
   * Only this function knows it: reading it back from the reason text would be
   * guessing, and the interface needs to say "it is raining, the mark is
   * capped" instead of leaving the numbers looking broken.
   */
  tope: ScoreCap | null;
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

/**
 * Sky score from a cloud-cover percentage (Open-Meteo's hourly forecast, which
 * has no icon). The cuts are OpenWeather's icon bands — 01x clear, 02x few,
 * 03x scattered, 04x broken — and the values are the ones `ICON_SKY_SCORE`
 * already gives them, so the same sky scores the same whichever source
 * describes it. Without that, comparing "now" against "later" would measure
 * the difference between two providers instead of a change in the weather.
 */
export function skyScoreFromCloudCover(cloudCoverPct: number): number {
  if (cloudCoverPct <= 10) return ICON_SKY_SCORE['01d'];
  if (cloudCoverPct <= 25) return ICON_SKY_SCORE['02d'];
  if (cloudCoverPct <= 50) return ICON_SKY_SCORE['03d'];
  return ICON_SKY_SCORE['04d'];
}

function skyScoreFromDescription(desc: string): number {
  const s = desc.toLowerCase();
  if (/(despejado|soleado)/.test(s)) return 25;
  if (/(poco\s*nuboso|intervalos|parcial|claro)/.test(s)) return 20;
  // "nubes dispersas" (OpenWeather 03x, 25-50% cover) before the generic
  // "nubes" (04x, overcast), which is indeed a cloudy sky.
  if (/nubes\s*dispersas/.test(s)) return 16;
  if (/(nuboso|nublado|cubierto|muy nuboso|nubes)/.test(s)) return 10;
  if (/(lluvia|chubasc|llovizna)/.test(s)) return 0;
  if (/(tormenta|eléctrica|rayos)/.test(s)) return 0;
  if (/(niebla|bruma|neblina)/.test(s)) return 4;
  if (/(nieve|nevada|aguanieve)/.test(s)) return 0;
  return 8;
}

/**
 * Maps a sky description (es) to a short word for the ranking "reason".
 * Covers AEMET terms (forecast) and OpenWeather terms (observation, e.g.
 * "cielo claro", "algo de nubes", "muy nuboso"). Returns null if it does not
 * recognize the term (the caller will use the raw text).
 */
function skyWordFromDescription(desc: string, esNoche = false): string | null {
  const s = desc.toLowerCase();
  // After sunset there is no sun to name: the same sky is "Despejado". The
  // client shows the very same words next to this reason, so naming a sun at
  // 3 a.m. here would contradict the beach headline one tap away.
  if (/(despejado|soleado|cielo claro)/.test(s)) return esNoche ? 'Despejado' : 'Sol';
  if (/(poco\s*nuboso|intervalos|parcial|algo de nubes|nubes\s*dispersas|claro)/.test(s))
    return esNoche ? 'Parcialmente despejado' : 'Parcialmente soleado';
  if (/(muy nuboso|nuboso|nublado|cubierto|nubes)/.test(s)) return 'Nublado';
  if (/(lluvia|chubasc|llovizna)/.test(s)) return 'Lluvia';
  if (/(tormenta|eléctrica|rayos)/.test(s)) return 'Tormenta';
  if (/(niebla|bruma|neblina)/.test(s)) return 'Niebla';
  return null;
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

/**
 * Temperature (0-25), the factor that decides whether the day is worth going.
 *
 * It used to be worth 20 and to treat 22 °C as a 14/20 — a 70% for what anyone
 * on this coast calls a very good beach day. The curve now climbs earlier and
 * flattens out: 22 °C already scores 22/25, and the last three points are
 * spread all the way to 30 °C, so the difference between a good day and a very
 * good one stops deciding the ranking on its own.
 *
 * The five points come from the UV factor, deleted on purpose: a high index is
 * a reason to bring sunscreen, not to rate the beach worse.
 */
export function computeTemperatureScore(tempC: number | null): number {
  if (tempC == null) return 9;
  if (tempC < 12) return 0;
  if (tempC < 16) return interpolate(tempC, 12, 16, 0, 6);
  if (tempC < 19) return interpolate(tempC, 16, 19, 6, 13);
  if (tempC < 22) return interpolate(tempC, 19, 22, 13, 22);
  if (tempC <= 30) return interpolate(tempC, 22, 30, 22, 25);
  if (tempC <= 34) return interpolate(tempC, 30, 34, 25, 20);
  return interpolate(Math.min(tempC, 40), 34, 40, 20, 14);
}

// ---------------------------------------------------------------------------
// Flag score (0-10)
// ---------------------------------------------------------------------------

/**
 * `unknown` scores the SAME neutral as having no flag service at all, and that
 * is the whole point: there is a flag flying, what is missing is our reading of
 * it. Docking points for it punished the beach for a failure of ours — and
 * punished it HARDER than a beach with no lifeguards, which walks away with the
 * neutral 5. Ignorance is not evidence of bad conditions.
 *
 * Safety does not rest on this number: a stale black or red keeps its colour
 * (see `GetFeaturedBeaches.getFlagForBeach`) and keeps excluding the beach, so
 * what degrades to `unknown` is only ever a green or a yellow.
 */
const FLAG_SCORE: Record<FlagColor, number> = {
  green: 10,
  yellow: 5,
  red: 0,
  black: 0,
  unknown: 5,
};

/** Neutral when there is nothing to judge: no service, or no reading of it. */
const FLAG_NEUTRAL = 5;

export function computeFlagScore(flag: FlagStatus | null): number {
  if (!flag || !flag.color) return FLAG_NEUTRAL; // no CR coverage → neutral
  return FLAG_SCORE[flag.color] ?? FLAG_NEUTRAL;
}

// ---------------------------------------------------------------------------
// Wind score (0-25)
// ---------------------------------------------------------------------------

export function computeWindScore(windSpeedMs: number | null): number {
  if (windSpeedMs == null) return 12;
  if (windSpeedMs <= 3) return 25;
  if (windSpeedMs <= 5) return interpolate(windSpeedMs, 3, 5, 25, 20);
  if (windSpeedMs <= 8) return interpolate(windSpeedMs, 5, 8, 20, 13);
  if (windSpeedMs <= 12) return interpolate(windSpeedMs, 8, 12, 13, 5);
  return interpolate(Math.min(windSpeedMs, 20), 12, 20, 5, 0);
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
// UV does NOT score.
//
// It used to be worth 5 points and to dock them from any beach with a high
// index — which on this coast is every clear summer day, exactly the days
// worth going. A high UV is a reason to bring sunscreen, not to rate the beach
// worse, so its weight went to temperature. The index is still published and
// shown on the beach page: it is information, not a penalty.
// ---------------------------------------------------------------------------

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
  rain?: RainNowcast | null,
  rainForecast?: RainForecastSignal | null,
  flagOperators: readonly string[] = LEGACY_FLAG_OPERATORS,
  outlook?: OutlookSignal | null,
): ScoringResult {
  const isSurf = attributes?.surf === true;
  const hasFlagService = flagOperators.length > 0;
  // A region with no operator has no flag, whatever the caller passed. Ignoring
  // it in `bandera` but honouring it in `datos` was worth 2 points that the
  // rescale then multiplied past 100 — the function broke its own range.
  const effectiveFlag = hasFlagService ? flag : null;

  const subScores: SubScores = {
    cielo: computeSkyScore(weather),
    temperatura: computeTemperatureScore(weather?.temperatureC ?? null),
    // 0 and out of the sum with no operator in the region: there is no flag to
    // judge, so a neutral 5/10 would be inventing a middling reading.
    bandera: hasFlagService ? computeFlagScore(effectiveFlag) : 0,
    viento: computeWindScore(weather?.windSpeedMs ?? null),
    oleaje: computeWavesScore(enrichment, weather, isSurf),
    datos: computeDataScore(weather, effectiveFlag),
    pronostico: outlook?.delta ?? 0,
  };

  const raw = subScores.cielo
    + subScores.temperatura
    + subScores.bandera
    + subScores.viento
    + subScores.oleaje
    + subScores.datos;

  // Rescaled BEFORE the rain caps below: those caps are absolute band
  // boundaries (<60 = never "good"), not a share of the reachable maximum.
  let score = hasFlagService ? raw : rescaleWithoutFlag(raw);

  // What the next few hours bring, bounded to ±OUTLOOK_MAX_DELTA. An
  // IMPROVEMENT goes in before the caps, so it is still subject to them.
  const delta = outlook?.delta ?? 0;
  if (delta > 0) score += delta;

  let tope: ScoreCap | null = null;

  // FORECAST rain (next few hours): soft yellow.
  if (rainForecast?.expected && score > RAIN_FORECAST_SCORE_CAP) {
    score = RAIN_FORECAST_SCORE_CAP;
    tope = 'lluvia_prevista';
  }

  // Rain detected now (multi-source signal): the beach can never be "good",
  // no matter what happens with the other factors. It beats the forecast one.
  if (rain?.status === 'raining' && score > RAIN_SCORE_CAP) {
    score = RAIN_SCORE_CAP;
    tope = 'lluvia';
  }

  // A DETERIORATION lands after the caps, so it counts below them too. The
  // asymmetry is deliberate and points the safe way: while it rains the beach
  // cannot be sold as good however much the sky is clearing, but one that is
  // already capped AND getting worse must rank under one that is merely
  // capped. Applied before the cap it would vanish — which is exactly when
  // half the coast sits on the cap and the ranking most needs to separate them.
  if (delta < 0) score += delta;

  // Last line of defence on the published range. Everything above should stay
  // within 0-100 on its own; this is here so an inconsistent input can never
  // put a score outside it into the API, the bands or the map colours.
  score = Math.max(0, Math.min(SCORE_MAX, score));

  return { score, subScores, tope };
}

// ---------------------------------------------------------------------------
// Ranking reason (human-readable)
// ---------------------------------------------------------------------------

export function buildRankingReason(
  subScores: SubScores,
  weather: Weather | null,
  flag: FlagStatus | null,
  enrichment?: ForecastEnrichment | null,
  rain?: RainNowcast | null,
  rainForecast?: RainForecastSignal | null,
  outlook?: OutlookSignal | null,
): string {
  const parts: string[] = [];

  // Rain detected now takes precedence over the sky description (which may
  // still say "nuboso" even though it is raining).
  const rainPart = rainReasonFragment(rain);

  // Prefer the real observation (OpenWeather current) over the AEMET forecast,
  // so the "reason" matches the current sky (and the detail view).
  const skyDesc =
    (weather?.source === 'OpenWeather' ? weather.description : null) ?? enrichment?.summary ?? null;
  // The provider's own day/night call (the `d`/`n` suffix on its icon), which
  // follows the real sunset at these coordinates.
  const esNoche = weather?.icon?.endsWith('n') === true;
  const skyWord = skyDesc ? skyWordFromDescription(skyDesc, esNoche) : null;
  if (rainPart) {
    parts.push(rainPart.charAt(0).toUpperCase() + rainPart.slice(1));
  } else if (skyWord) {
    parts.push(skyWord);
  } else if (subScores.cielo >= 20) {
    parts.push(esNoche ? 'Despejado' : 'Sol');
  } else if (subScores.cielo >= 15) {
    parts.push(esNoche ? 'Parcialmente despejado' : 'Parcialmente soleado');
  } else if (subScores.cielo >= 10) {
    parts.push('Nublado');
  } else if (skyDesc) {
    // Unrecognized text and bad sky (rain/storm): show the raw text.
    parts.push(skyDesc.charAt(0).toUpperCase() + skyDesc.slice(1));
  }

  const temp = weather?.temperatureC ?? enrichment?.temperatureC;
  if (temp != null) parts.push(`${Math.round(temp)}\u00B0`);

  if (enrichment?.wind) {
    parts.push(enrichment.wind.toLowerCase());
  } else {
    const windMs = weather?.windSpeedMs;
    if (windMs != null) {
      if (windMs < 3) parts.push('sin viento');
      else if (windMs < 6) parts.push('brisa suave');
      else if (windMs < 10) parts.push('viento moderado');
      else if (windMs < 15) parts.push('viento fresco');
      else parts.push('viento fuerte');
    }
  }

  if (flag?.color === 'green') parts.push('bandera verde');
  else if (flag?.color === 'yellow') parts.push('precauci\u00F3n');

  // Forecast rain: only if it is NOT already raining and the sky does not already say rain/storm.
  const forecastPart = rainPart ? null : rainForecastReasonFragment(rainForecast);
  if (forecastPart && skyWord !== 'Lluvia' && skyWord !== 'Tormenta') {
    parts.push(forecastPart);
  }

  // Only the good news here: a beach that is getting worse says so in
  // `motivoBaja`, which is the channel the interface reads for that.
  if (outlook?.direccion === 'mejora') {
    const mejora = outlookReasonFragment(outlook);
    if (mejora) parts.push(mejora);
  }

  return parts.join(', ') || 'Condiciones aceptables';
}

// ---------------------------------------------------------------------------
// Caution reason (human-readable, for low-scoring beaches)
// ---------------------------------------------------------------------------

export function buildCautionReason(
  subScores: SubScores,
  weather: Weather | null,
  flag: FlagStatus | null,
  _enrichment?: ForecastEnrichment | null,
  rain?: RainNowcast | null,
  rainForecast?: RainForecastSignal | null,
  outlook?: OutlookSignal | null,
): string {
  const parts: string[] = [];

  if (flag?.color === 'red') parts.push('bandera roja');
  else if (flag?.color === 'black') parts.push('ba\u00F1o prohibido');
  else if (flag?.color === 'yellow') parts.push('bandera amarilla');

  const rainPart = rainReasonFragment(rain);
  if (rainPart) parts.push(rainPart);
  const forecastPart = rainPart ? null : rainForecastReasonFragment(rainForecast);
  if (forecastPart) parts.push(forecastPart);

  if (subScores.viento <= 5) parts.push('viento fuerte');
  if (subScores.oleaje <= 2) parts.push('oleaje fuerte');
  if (subScores.cielo <= 3 && !rainPart && !forecastPart) parts.push('lluvia o tormenta');
  if (subScores.temperatura <= 5) parts.push('temperatura baja');

  if (outlook?.direccion === 'empeora') {
    const empeora = outlookReasonFragment(outlook);
    if (empeora) parts.push(empeora);
  }

  if (parts.length === 0) parts.push('condiciones poco favorables');

  // Capitalize first part
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Downgrade factors (human-readable, for medium/bad beaches on the map)
// ---------------------------------------------------------------------------

export function buildDowngradeFactors(
  subScores: SubScores,
  flag: FlagStatus | null,
  rain?: RainNowcast | null,
  rainForecast?: RainForecastSignal | null,
  flagOperators: readonly string[] = LEGACY_FLAG_OPERATORS,
  outlook?: OutlookSignal | null,
  /**
   * Does the beach have a lifeguard station ON RECORD (a `flagRef` or listed
   * stations)? It is not the same question as "do we have a reading": a covered
   * beach whose scrape failed, or whose station id is still pending, arrives
   * here with `flag === null` exactly like an unwatched one.
   */
  hasFlagStation = false,
): string | null {
  const parts: string[] = [];

  const rainPart = rainReasonFragment(rain);
  const forecastPart = rainPart ? null : rainForecastReasonFragment(rainForecast);
  if (rainPart) parts.push(rainPart);
  else if (forecastPart) parts.push(forecastPart);
  else if (subScores.cielo <= 5) parts.push('lluvia');
  else if (subScores.cielo <= 10) parts.push('cielo nublado');

  if (subScores.temperatura <= 8) parts.push('temperatura fresca');

  // Naming the operator only makes sense where one exists. With no service in
  // the region the absence of a flag is not a downgrade factor at all: it would
  // be listed on every single beach and say nothing about any of them.
  //
  // And on a beach that IS watched, a missing reading is our gap, not the
  // operator's: saying "sin cobertura Cruz Roja" on a beach with a station
  // states as fact the opposite of what the detail page shows. Say nothing.
  const operador = flagOperators[0];
  if (flag?.color === 'yellow') parts.push('bandera amarilla');
  else if (flag?.color === 'red') parts.push('bandera roja');
  else if (!flag?.color && operador && !hasFlagStation) parts.push(`sin cobertura ${operador}`);

  if (subScores.viento <= 8) parts.push('viento fuerte');
  if (subScores.oleaje <= 3) parts.push('oleaje fuerte');

  if (outlook?.direccion === 'empeora') {
    const empeora = outlookReasonFragment(outlook);
    if (empeora) parts.push(empeora);
  }

  if (parts.length === 0) return null;
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
