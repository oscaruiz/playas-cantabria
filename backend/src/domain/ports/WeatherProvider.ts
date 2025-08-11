import { Weather } from '../entities/Weather';

export interface WeatherProvider {
  /**
   * Get current weather for coordinates.
   * Implementations should throw a ProviderError on hard failures/timeouts.
   */
  getCurrentByCoords(lat: number, lon: number): Promise<Weather>;
}

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly causeName?: string;

  constructor(provider: string, message: string, causeName?: string) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.causeName = causeName;
  }
}
