import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus, FlagRef } from '../entities/Flag';
import { RainNowcast } from '../entities/RainNowcast';
import { GetRainNowcast } from './GetRainNowcast';
import { buildRainForecastSignal } from './RainForecast';
import { BeachRepository } from '../ports/BeachRepository';
import { WeatherProvider } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { resolveFlagForStations } from '../services/flagAggregation';
import { SunshineProvider } from '../ports/SunshineProvider';
import { SunshineObservation } from '../entities/Sunshine';
import { corregirCieloObservado } from '../../application/services/skyCorrectionRunner';
import { InMemoryCache, CacheKeys } from '../../infrastructure/cache/InMemoryCache';
import { Config, skyCorrectionMode } from '../../infrastructure/config/config';
import { AemetBeachForecastProvider, AemetBeachForecast } from '../../infrastructure/providers/AemetBeachForecastProvider';
import {
  ForecastEnrichment,
  computeBeachScore,
  buildRankingReason,
  buildCautionReason,
  buildDowngradeFactors,
  buildExclusionReason,
  isExcluded,
} from './BeachScorer';
import type { FeaturedBeachResult } from '../../application/mappers/FeaturedBeachMapper';

const MIN_SCORE = 30;
const MIN_BEACHES = 2;
const CAUTION_COUNT = 3;
const ENRICHMENT_CONCURRENCY = 6;

export interface FeaturedBeachesFullResult {
  mejores: FeaturedBeachResult[];
  revisar: FeaturedBeachResult[];
  resumenTodas: FeaturedBeachResult[];
}

export class GetFeaturedBeaches {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly aemet: WeatherProvider,
    private readonly openWeather: WeatherProvider,
    private readonly flags: FlagProvider,
    private readonly aemetForecast: AemetBeachForecastProvider,
    private readonly cache: InMemoryCache,
    private readonly rainNowcast: GetRainNowcast,
    /**
     * Optional on purpose: without it, the sky corrector simply does not run
     * and the listing behaves exactly as before.
     */
    private readonly sunshine: SunshineProvider | undefined,
    private readonly regionId: string,
    /**
     * Public names of the region's flag operators; empty means the region has
     * no lifeguard-flag service. Required so a new region cannot inherit
     * Cantabria's operator by forgetting to declare its own.
     */
    private readonly flagOperators: readonly string[],
  ) {}

  async execute(topN = 5): Promise<FeaturedBeachesFullResult> {
    return this.cache.getOrSetStale<FeaturedBeachesFullResult>(
      CacheKeys.featuredBeaches(this.regionId),
      Config.featuredFreshTtlSeconds(),
      Config.featuredStaleTtlSeconds(),
      () => this.compute(topN),
    );
  }

  private async compute(topN: number): Promise<FeaturedBeachesFullResult> {
    const beaches = await this.beachRepo.getAll();

    const enriched: Array<Awaited<ReturnType<GetFeaturedBeaches['enrichBeach']>> | null> =
      new Array(beaches.length).fill(null);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < beaches.length) {
        const index = nextIndex++;
        try {
          enriched[index] = await this.enrichBeach(beaches[index]);
        } catch {
          enriched[index] = null;
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(ENRICHMENT_CONCURRENCY, beaches.length) },
        () => worker(),
      ),
    );

    const good: FeaturedBeachResult[] = [];
    const caution: FeaturedBeachResult[] = [];
    const all: FeaturedBeachResult[] = [];

    for (const result of enriched) {
      if (!result) continue;
      const { beach, weather, flag, enrichment, rain } = result;

      // Excluded beaches go directly to caution with specific reason
      if (isExcluded(weather, flag, enrichment)) {
        const reason = buildExclusionReason(weather, flag, enrichment);
        const entry = { beach, weather, flag, score: 0, reason, downgradeReason: reason, enrichment };
        caution.push(entry);
        all.push(entry);
        continue;
      }

      // Forecast rain: Open-Meteo numeric forecast (next 6h, comes in the
      // nowcast) ∪ AEMET's text for the day ("Chubascos"...).
      const rainForecast = buildRainForecastSignal(rain, [enrichment?.summary ?? null]);

      const { score, subScores } = computeBeachScore(
        weather,
        flag,
        enrichment,
        beach.attributes,
        rain,
        rainForecast,
        this.flagOperators,
      );

      const downgradeReason = buildDowngradeFactors(
        subScores,
        flag,
        rain,
        rainForecast,
        this.flagOperators,
      );

      if (score >= MIN_SCORE) {
        const reason = buildRankingReason(subScores, weather, flag, enrichment, rain, rainForecast);
        const entry = { beach, weather, flag, score, reason, downgradeReason, enrichment };
        good.push(entry);
        all.push(entry);
      } else {
        const reason = buildCautionReason(subScores, weather, flag, enrichment, rain, rainForecast);
        const entry = { beach, weather, flag, score, reason, downgradeReason, enrichment };
        caution.push(entry);
        all.push(entry);
      }
    }

    // Sort good by score desc
    good.sort((a, b) => b.score - a.score || a.beach.name.localeCompare(b.beach.name));

    // Sort caution by score asc (worst first)
    caution.sort((a, b) => a.score - b.score || a.beach.name.localeCompare(b.beach.name));

    // Sort all by name for stable lookup
    all.sort((a, b) => a.beach.name.localeCompare(b.beach.name));

    const mejores = good.length >= MIN_BEACHES ? good.slice(0, topN) : [];
    const revisar = caution.slice(0, CAUTION_COUNT);

    return { mejores, revisar, resumenTodas: all };
  }

  private async enrichBeach(beach: Beach): Promise<{
    beach: Beach;
    weather: Weather | null;
    flag: FlagStatus | null;
    enrichment: ForecastEnrichment | null;
    rain: RainNowcast | null;
  }> {
    const [weather, flag, enrichment, rain, sol] = await Promise.all([
      this.getWeatherRace(beach.latitude, beach.longitude),
      this.getFlagForBeach(beach),
      // Beaches without an AEMET page (synthetic code) must not trigger an
      // AEMET call that would always 404: the enrichment one is skipped.
      beach.sinAemet ? Promise.resolve(null) : this.getForecastEnrichment(beach.aemetCode),
      this.getRainSafe(beach.latitude, beach.longitude),
      this.getSunshineSafe(beach.latitude, beach.longitude),
    ]);

    return {
      beach,
      // The Weather object is corrected at the source and not at render time:
      // description, icon, ranking reason and score all come from here, so by
      // correcting it beforehand they cannot end up contradicting each other.
      weather: corregirCieloObservado(beach.name, weather, sol, rain?.status === 'raining'),
      flag,
      enrichment,
      rain,
    };
  }

  private async getSunshineSafe(lat: number, lon: number): Promise<SunshineObservation[]> {
    if (!this.sunshine || skyCorrectionMode() === 'off') return [];
    try {
      return await this.sunshine.getSunshineNear(lat, lon);
    } catch {
      return [];
    }
  }


  private async getRainSafe(lat: number, lon: number): Promise<RainNowcast | null> {
    try {
      return await this.rainNowcast.execute(lat, lon);
    } catch {
      return null;
    }
  }

  /**
   * OpenWeather first (reliable, consistent across beaches).
   * AEMET as fallback only if OpenWeather fails.
   */
  private async getWeatherRace(lat: number, lon: number): Promise<Weather | null> {
    try {
      return await this.openWeather.getCurrentByCoords(lat, lon);
    } catch {
      try {
        return await this.aemet.getCurrentByCoords(lat, lon);
      } catch {
        return null;
      }
    }
  }

  /** Beach flag: aggregates several stations if present, or uses the single reference. */
  private getFlagForBeach(beach: Beach): Promise<FlagStatus | null> {
    return resolveFlagForStations(beach.flagRef, beach.flagStations, (ref) =>
      this.getFlagSafe(ref),
    );
  }

  private async getFlagSafe(ref?: FlagRef): Promise<FlagStatus | null> {
    if (!ref) return null;
    try {
      return await this.flags.getFlag(ref);
    } catch {
      return null;
    }
  }

  private async getForecastEnrichment(codigo: string): Promise<ForecastEnrichment | null> {
    try {
      const forecast: AemetBeachForecast = await this.aemetForecast.getByBeachCode(codigo);
      const today = forecast.today;
      return {
        waves: today.waves || null,
        uvIndex: today.uvIndex ?? null,
        warningLevel: null, // AemetBeachForecastProvider doesn't provide warnings
        temperatureC: today.temperature ?? null,
        summary: today.summary || null,
        wind: today.wind || null,
      };
    } catch {
      return null;
    }
  }
}
