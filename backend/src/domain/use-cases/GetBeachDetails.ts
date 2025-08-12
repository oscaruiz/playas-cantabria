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
 * Fallback policy for weather:
 * - Try AEMET first as primary weather provider.
 * - If AEMET fails, fallback to OpenWeather automatically.
 * - Return null only if both providers fail.
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
      this.getWeatherHedged(beach.latitude, beach.longitude, 500),
      this.getFlagSafe(beach.redCrossId),
      this.getTidesSafe(beach.latitude, beach.longitude),
    ]);

    return { beach, weather, flag, tides: tideInfo };
  }

  private async getWeatherHedged(lat: number, lon: number, hedgeDelayMs: number): Promise<Weather | null> {
    // 🥇 INTENTAR AEMET PRIMERO
    try {
      console.log('🌤️ Intentando obtener datos de AEMET...');
      const aemetWeather = await this.aemet.getCurrentByCoords(lat, lon);
      console.log('✅ AEMET exitoso:', aemetWeather.source);
      return aemetWeather;
    } catch (aemetError) {
      console.log('❌ AEMET falló:', aemetError);
      
      // 🥈 FALLBACK A OPENWEATHER
      try {
        console.log('🌤️ Fallback: Intentando OpenWeather...');
        const openWeatherData = await this.openWeather.getCurrentByCoords(lat, lon);
        console.log('✅ OpenWeather exitoso:', openWeatherData.source);
        return openWeatherData;
      } catch (openWeatherError) {
        console.log('❌ OpenWeather también falló:', openWeatherError);
        
        // 🚨 AMBOS FALLARON
        console.log('🚨 Todos los proveedores de clima fallaron');
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

  private async getTidesSafe(lat: number, lon: number): Promise<Tides | null> {
    if (!this.tides) return null;
    try {
      return await this.tides.getTidesByCoords(lat, lon);
    } catch {
      return null;
    }
  }
}
