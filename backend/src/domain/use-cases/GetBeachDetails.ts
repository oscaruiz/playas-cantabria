import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus } from '../entities/Flag';
import { Tides } from '../entities/Tides';
import { BeachRepository } from '../ports/BeachRepository';
import { WeatherProvider } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { TidesProvider } from '../ports/TidesProvider';

export interface BeachDetails {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  tides: Tides | null;
}

export class DetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetailsError';
  }
}

/**
 * Fallback policy for weather (hedged):
 * - Start AEMET immediately.
 * - Start OpenWeather after a small delay, or immediately if AEMET fails fast.
 * - Return the first successful response. If both fail, return null.
 */
export class GetBeachDetails {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly aemet: WeatherProvider,
    private readonly openWeather: WeatherProvider,
    private readonly flags: FlagProvider,
    private readonly tides: TidesProvider | null
  ) {}

  async execute(id: string): Promise<BeachDetails> {
    const beach = await this.beachRepo.getById(id);
    if (!beach) {
      throw new DetailsError(`Beach with id '${id}' not found`);
    }

    const [weather, flag, tideInfo] = await Promise.all([
      this.getWeatherHedged(beach.latitude, beach.longitude, 300),
      this.getFlagSafe(beach.redCrossId),
      this.getTidesSafe(beach.latitude, beach.longitude),
    ]);

    return { beach, weather, flag, tides: tideInfo };
  }

  private async getWeatherHedged(lat: number, lon: number, hedgeDelayMs: number): Promise<Weather | null> {
    // Start AEMET immediately
    const aemetPromise = this.aemet.getCurrentByCoords(lat, lon);

    // Controlled OW start
    let owStarted = false;
    let startOW: () => void = () => {};
    const owPromise: Promise<Weather> = new Promise((resolve, reject) => {
      startOW = () => {
        if (owStarted) return;
        owStarted = true;
        this.openWeather.getCurrentByCoords(lat, lon).then(resolve).catch(reject);
      };
      // Hedge: start OW after delay in case AEMET is slow
      setTimeout(() => startOW(), hedgeDelayMs);
    });

    // If AEMET fails fast, trigger OW immediately
    aemetPromise.catch(() => startOW());

    // Return first successful result; null if both fail
    const result = await new Promise<Weather | null>((resolve) => {
      let settled = false;

      aemetPromise
        .then((w) => {
          if (!settled) {
            settled = true;
            resolve(w);
          }
        })
        .catch(() => {
          // no-op, handled by allSettled below
        });

      owPromise
        .then((w) => {
          if (!settled) {
            settled = true;
            resolve(w);
          }
        })
        .catch(() => {
          // no-op, handled by allSettled below
        });

      Promise.allSettled([aemetPromise, owPromise]).then((results) => {
        if (!settled && results.every((r) => r.status === 'rejected')) {
          settled = true;
          resolve(null);
        }
      });
    });

    return result;
  }

  private async getFlagSafe(redCrossId?: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;
    try {
      return await this.flags.getFlagByRedCrossId(redCrossId);
    } catch {
      return null;
    }
  }

  private async getTidesSafe(lat: number, lon: number): Promise<Tides | null> {
    if (!this.tides) return null;
    try {
      return await this.tides.getTidesByCoords(lat, lon);
    } catch {
      return null;
    }
  }
}
