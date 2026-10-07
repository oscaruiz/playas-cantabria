import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus } from '../entities/Flag';
import { RainNowcast } from '../entities/RainNowcast';
import { BeachRepository } from '../ports/BeachRepository';
import { esColorRestrictivo, vigenciaBandera } from '../services/flagVigencia';
import { BeachShortForecast } from '../entities/BeachForecast';
import { BeachForecastProvider } from '../ports/BeachForecastProvider';
import { Cache } from '../ports/Cache';
import { ForecastEnrichment } from './BeachScorer';
import { assessBeach, MIN_SCORE, FeaturedBeachResult } from './BeachAssessment';
import { BeachConditions } from './BeachConditions';

/** Runtime settings, read on every call (config and env can change underneath). */
export interface FeaturedBeachesSettings {
  /** Region-scoped key the ranking is cached under (also seeded from snapshot). */
  cacheKey: string;
  freshTtlSeconds(): number;
  staleTtlSeconds(): number;
}

const MIN_BEACHES = 2;
const CAUTION_COUNT = 3;
const ENRICHMENT_CONCURRENCY = 6;

export interface FeaturedBeachesFullResult {
  mejores: FeaturedBeachResult[];
  revisar: FeaturedBeachResult[];
  resumenTodas: FeaturedBeachResult[];
  /**
   * When this ranking was ASSEMBLED. It travels inside the cached value on
   * purpose: that is the only way a stale hit keeps the instant of the sky it
   * is actually carrying instead of the instant it happened to be served.
   *
   * The endpoint used to stamp `Date.now()` on the way out, so a ranking from
   * an hour ago went out claiming to be a second old — and the front page,
   * which already knows how to warn that what it paints is old, could never
   * tell. Optional because a snapshot written before this field exists is
   * seeded without it.
   */
  generadoEn?: number;
}

export class GetFeaturedBeaches {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly beachForecast: BeachForecastProvider,
    private readonly cache: Cache,
    private readonly conditions: BeachConditions,
    /**
     * Public names of the region's flag operators; empty means the region has
     * no lifeguard-flag service. Required so a new region cannot inherit
     * Cantabria's operator by forgetting to declare its own.
     */
    private readonly flagOperators: readonly string[],
    private readonly settings: FeaturedBeachesSettings,
  ) {}

  async execute(topN = 5): Promise<FeaturedBeachesFullResult> {
    return this.cache.getOrSetStale<FeaturedBeachesFullResult>(
      this.settings.cacheKey,
      this.settings.freshTtlSeconds(),
      this.settings.staleTtlSeconds(),
      () => this.compute(topN),
    );
  }

  private async compute(topN: number): Promise<FeaturedBeachesFullResult> {
    const beaches = await this.beachRepo.getAll();

    // If AEMET sunshine is down, reject this refresh so getOrSetStale keeps
    // serving the last corrected ranking instead of replacing all skies with
    // uncorrected OpenWeather 04d.
    if (beaches.length > 0) await this.conditions.probeSunshine(beaches[0]);

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
      const entry = assessBeach(result, this.flagOperators);
      (entry.score >= MIN_SCORE ? good : caution).push(entry);
      all.push(entry);
    }

    // Sort good by score desc
    good.sort((a, b) => b.score - a.score || a.beach.name.localeCompare(b.beach.name));

    // Sort caution by score asc (worst first)
    caution.sort((a, b) => a.score - b.score || a.beach.name.localeCompare(b.beach.name));

    // Sort all by name for stable lookup
    all.sort((a, b) => a.beach.name.localeCompare(b.beach.name));

    const mejores = good.length >= MIN_BEACHES ? good.slice(0, topN) : [];
    const revisar = caution.slice(0, CAUTION_COUNT);

    return { mejores, revisar, resumenTodas: all, generadoEn: Date.now() };
  }

  private async enrichBeach(beach: Beach): Promise<{
    beach: Beach;
    weather: Weather | null;
    flag: FlagStatus | null;
    enrichment: ForecastEnrichment | null;
    rain: RainNowcast | null;
  }> {
    const [now, enrichment] = await Promise.all([
      this.conditions.now(beach),
      // Beaches without an AEMET page (synthetic code) must not trigger an
      // AEMET call that would always 404: the enrichment one is skipped.
      beach.sinAemet ? Promise.resolve(null) : this.getForecastEnrichment(beach.aemetCode),
    ]);
    return { beach, weather: now.weather, flag: flagForRanking(now.flag), enrichment, rain: now.rain };
  }

  private async getForecastEnrichment(codigo: string): Promise<ForecastEnrichment | null> {
    try {
      const forecast: BeachShortForecast = await this.beachForecast.getByBeachCode(codigo);
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

/**
 * The flag the ranking judges by: the raw reading, DISCARDED if it is no
 * longer current.
 *
 * That last part is the point. Outside lifeguard hours the interface already
 * refuses to paint a colour, but the score and the ranking reason were still
 * built from the raw flag: at midnight the app published `bandera: null` and,
 * in the same object, "bandera verde" worth 10 points. It contradicted
 * itself, and it inflated the rating with a flag captured hours earlier.
 *
 * Discarding is only right when there is NO service. A reading that goes
 * stale during the watch means the delivery broke, not that the beach was
 * cleared: turning it into `null` there let a lost black flag score as
 * "no coverage" (neutral 5/10) and re-enter the ranking. So a restrictive
 * colour survives its own staleness — it keeps excluding until something
 * tells us it was taken down — and any other stale colour degrades to
 * `unknown`, which neither publishes a colour nor scores as good.
 *
 * Ranking-only on purpose: the detail keeps the raw reading because it shows
 * the schedule and the last recorded colour outside lifeguard hours.
 */
function flagForRanking(flag: FlagStatus | null): FlagStatus | null {
  if (!flag) return null;
  switch (vigenciaBandera(flag)) {
    case 'vigente':
      return flag;
    case 'sin-servicio':
      return null;
    case 'caducada':
      return esColorRestrictivo(flag.color) ? flag : { ...flag, color: 'unknown' };
  }
}
