import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus } from '../entities/Flag';
import { RainNowcast } from '../entities/RainNowcast';
import { buildRainForecastSignal } from './RainForecast';
import { buildWeatherOutlook, resolvePublishedOutlook, OutlookSignal } from './WeatherOutlook';
import { buildDayWindow, DayWindowSignal } from './BeachWindowScorer';
import {
  ForecastEnrichment,
  ScoreCap,
  SubScores,
  computeBeachScore,
  buildRankingReason,
  buildCautionReason,
  buildDowngradeFactors,
  buildExclusionReason,
  isExcluded,
} from './BeachScorer';

/** Score from which a beach is recommended rather than sent to "revisar". */
export const MIN_SCORE = 30;

/** The judged beach: what the ranking sorts and `FeaturedBeachMapper` publishes. */
export interface FeaturedBeachResult {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  score: number;
  reason: string;
  downgradeReason: string | null;
  enrichment: ForecastEnrichment | null;
  /** Breakdown behind `score`. Absent on the excluded path, which never scores. */
  subScores?: SubScores | null;
  outlook?: OutlookSignal | null;
  tope?: ScoreCap | null;
  topeValor?: number | null;
  /** Best stretch of the remaining beach window. Absent on the excluded path. */
  ventanaDia?: DayWindowSignal | null;
  /** Aggregated rain nowcast; the score already reads it, the DTO publishes it. */
  rain?: RainNowcast | null;
  /**
   * The flag reading BEFORE the ranking's currency policy (`flag` is after it).
   * The card judges THIS one at serve time, like the detail does: judged once
   * at assembly, a ranking built at 11:59 hid the flag the detail showed at
   * 12:01 (found by Codex). Absent in entries written before it existed.
   */
  rawFlag?: FlagStatus | null;
}

/** Everything observed about one beach, before any judgement. */
export interface BeachConditions {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  enrichment: ForecastEnrichment | null;
  rain: RainNowcast | null;
}

/**
 * Is this beach watched, according to the catalog? A station with a pending id
 * counts: the beach has lifeguards, what we lack is a way to query them.
 */
function hasFlagStation(beach: Beach): boolean {
  return beach.flagRef != null || (beach.flagStations?.length ?? 0) > 0;
}

/**
 * The whole judgement of one beach: excluded or not, score and its breakdown,
 * the reasons, and when to go. Which signals each piece reads — and which
 * outlook, raw or published — is decided here and nowhere else.
 *
 * `score >= MIN_SCORE` is a recommendable beach; anything else, excluded
 * beaches included (score 0), belongs in "revisar".
 */
export function assessBeach(
  { beach, weather, flag, enrichment, rain }: BeachConditions,
  flagOperators: readonly string[],
  now: Date = new Date(),
): FeaturedBeachResult {
  // Excluded beaches go directly to caution with specific reason
  if (isExcluded(weather, flag, enrichment)) {
    const reason = buildExclusionReason(weather, flag, enrichment);
    return { beach, weather, flag, score: 0, reason, downgradeReason: reason, enrichment, rain };
  }

  // Forecast rain: Open-Meteo numeric forecast (next 6h, comes in the
  // nowcast) ∪ AEMET's text for the day ("Chubascos"...).
  const rainForecast = buildRainForecastSignal(rain, [enrichment?.summary ?? null]);

  // Is it about to get better or worse? Bounded correction from the next
  // 4h of sky, temperature and wind — it rides on the nowcast's own
  // request, so it costs nothing and it is null whenever Open-Meteo fails.
  const outlook = buildWeatherOutlook(weather, rain?.outlook);

  // WHEN to go: best stretch of the remaining beach window, from the same
  // slots. Open-Meteo only, symmetric with the outlook above: when it is
  // down the field is null and the interface shows nothing. The nowcast
  // rides along so rain falling NOW vetoes the next hour, whatever the
  // forecast claims.
  const ventanaDia = buildDayWindow(rain?.outlook, now, rain);

  const { score, subScores, tope, topeValor } = computeBeachScore(
    weather,
    flag,
    enrichment,
    beach.attributes,
    rain,
    rainForecast,
    flagOperators,
    outlook,
    now.getTime(),
  );

  const downgradeReason = buildDowngradeFactors(
    subScores,
    flag,
    rain,
    rainForecast,
    flagOperators,
    outlook,
    hasFlagStation(beach),
  );

  const reason = score >= MIN_SCORE
    ? buildRankingReason(subScores, weather, flag, enrichment, rain, rainForecast, outlook)
    : buildCautionReason(subScores, weather, flag, enrichment, rain, rainForecast, outlook);

  // The breakdown travels with the entry so the API can publish WHY the
  // beach scored what it scored, instead of the app explaining the model
  // in the abstract and leaving the actual question unanswered.
  //
  // The PUBLISHED outlook lets forecast rain take over the reason; the raw
  // one above is what scored and what the reason builders read. Keeping
  // them apart is not a detail: hand the resolved one to
  // `buildDowngradeFactors` and its `direccion: 'empeora'` appends "empeora
  // en las próximas horas" right next to the "lluvia prevista" that same
  // function already adds — the same fact, twice, in one line.
  return {
    beach,
    weather,
    flag,
    score,
    reason,
    downgradeReason,
    enrichment,
    rain,
    subScores,
    outlook: resolvePublishedOutlook(outlook, rainForecast),
    tope,
    topeValor,
    ventanaDia,
  };
}
