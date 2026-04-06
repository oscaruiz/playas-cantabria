import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus } from '../entities/Flag';
import { BeachRepository } from '../ports/BeachRepository';
import { WeatherProvider } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { InMemoryCache, CacheKeys } from '../../infrastructure/cache/InMemoryCache';
import { Config } from '../../infrastructure/config/config';
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
  ) {}

  async execute(topN = 5): Promise<FeaturedBeachesFullResult> {
    const ttl = Config.cacheTtlSeconds();

    return this.cache.getOrSet<FeaturedBeachesFullResult>(
      CacheKeys.featuredBeaches,
      ttl,
      () => this.compute(topN),
    );
  }

  private async compute(topN: number): Promise<FeaturedBeachesFullResult> {
    const beaches = await this.beachRepo.getAll();

    const settled = await Promise.allSettled(
      beaches.map((beach) => this.enrichBeach(beach)),
    );

    const good: FeaturedBeachResult[] = [];
    const caution: FeaturedBeachResult[] = [];
    const all: FeaturedBeachResult[] = [];

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { beach, weather, flag, enrichment } = result.value;

      // Excluded beaches go directly to caution with specific reason
      if (isExcluded(weather, flag, enrichment)) {
        const reason = buildExclusionReason(weather, flag, enrichment);
        const entry = { beach, weather, flag, score: 0, reason, downgradeReason: reason };
        caution.push(entry);
        all.push(entry);
        continue;
      }

      const { score, subScores } = computeBeachScore(
        weather,
        flag,
        enrichment,
        beach.attributes,
      );

      const downgradeReason = buildDowngradeFactors(subScores, flag);

      if (score >= MIN_SCORE) {
        const reason = buildRankingReason(subScores, weather, flag);
        const entry = { beach, weather, flag, score, reason, downgradeReason };
        good.push(entry);
        all.push(entry);
      } else {
        const reason = buildCautionReason(subScores, weather, flag);
        const entry = { beach, weather, flag, score, reason, downgradeReason };
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
  }> {
    const [weather, flag, enrichment] = await Promise.all([
      this.getWeatherRace(beach.latitude, beach.longitude),
      this.getFlagSafe(beach.redCrossId),
      this.getForecastEnrichment(beach.aemetCode),
    ]);

    return { beach, weather, flag, enrichment };
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

  private async getFlagSafe(redCrossId?: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;
    try {
      return await this.flags.getFlagByRedCrossId(redCrossId);
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
      };
    } catch {
      return null;
    }
  }
}
