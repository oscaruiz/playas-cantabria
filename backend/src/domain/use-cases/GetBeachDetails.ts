import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus, FlagRef } from '../entities/Flag';
import { Tides } from '../entities/Tides';
import { BeachRepository } from '../ports/BeachRepository';
import { WeatherProvider } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { TidesProvider } from '../ports/TidesProvider';
import { resolveFlagForStations } from '../services/flagAggregation';

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
      this.getWeatherConsistent(beach.latitude, beach.longitude),
      this.getFlagForBeach(beach),
      this.getTidesSafe(beach.latitude, beach.longitude),
    ]);

    return { beach, weather, flag, tides: tideInfo };
  }

  /**
   * OpenWeather first (reliable, consistent with featured endpoint).
   * AEMET as fallback only if OpenWeather fails.
   */
  private async getWeatherConsistent(lat: number, lon: number): Promise<Weather | null> {
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

  /**
   * Bandera de la playa. Si tiene varios puestos (con referencia conocida),
   * consulta todos en paralelo y agrega con la regla conservadora (la más
   * restrictiva). Si no, usa la referencia única (camino de las 20 legadas).
   */
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

  private async getTidesSafe(lat: number, lon: number): Promise<Tides | null> {
    if (!this.tides) return null;
    try {
      return await this.tides.getTidesByCoords(lat, lon);
    } catch {
      return null;
    }
  }
}
