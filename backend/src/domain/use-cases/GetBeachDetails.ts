import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus } from '../entities/Flag';
import { Tides } from '../entities/Tides';
import { BeachRepository } from '../ports/BeachRepository';
import { WeatherProvider, ProviderError } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { TidesProvider } from '../ports/TidesProvider';

export interface BeachDetails {
  beach: Beach;
  weather: Weather | null; // If both providers fail, we still return the beach & other details.
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
 * Business rule: try AEMET first, fallback to OpenWeather on error/timeout.
 * - If both fail, we return `weather: null` but do NOT fail the whole details call.
 * - Flag/Tides failures are non-fatal and yield nulls.
 */
export class GetBeachDetails {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly aemet: WeatherProvider,
    private readonly openWeather: WeatherProvider,
    private readonly flags: FlagProvider,
    private readonly tides: TidesProvider | null // optional, may be stubbed for now
  ) {}

  async execute(id: string): Promise<BeachDetails> {
    const beach = await this.beachRepo.getById(id);
    if (!beach) {
      throw new DetailsError(`Beach with id '${id}' not found`);
    }

    const [weather, flag, tideInfo] = await Promise.all([
      this.getWeatherWithFallback(beach.latitude, beach.longitude),
      this.getFlagSafe(beach.redCrossId),
      this.getTidesSafe(beach.latitude, beach.longitude),
    ]);

    return {
      beach,
      weather,
      flag,
      tides: tideInfo,
    };
  }

  private async getWeatherWithFallback(lat: number, lon: number): Promise<Weather | null> {
    try {
      return await this.aemet.getCurrentByCoords(lat, lon);
    } catch (errAemet) {
      // If AEMET fails, try OpenWeather
      try {
        return await this.openWeather.getCurrentByCoords(lat, lon);
      } catch (errOpen) {
        // Swallow both errors but keep logs upstream; return null to keep the endpoint stable.
        return null;
      }
    }
  }

  private async getFlagSafe(redCrossId?: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;
    try {
      return await this.flags.getFlagByRedCrossId(redCrossId);
    } catch (_e) {
      return null;
    }
  }

  private async getTidesSafe(lat: number, lon: number): Promise<Tides | null> {
    if (!this.tides) return null;
    try {
      return await this.tides.getTidesByCoords(lat, lon);
    } catch (_e) {
      return null;
    }
  }
}
