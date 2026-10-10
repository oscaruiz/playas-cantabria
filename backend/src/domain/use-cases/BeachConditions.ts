import { Beach } from '../entities/Beach';
import { Weather } from '../entities/Weather';
import { FlagStatus, FlagRef } from '../entities/Flag';
import { HourlyOutlookSlot, RainNowcast } from '../entities/RainNowcast';
import { SunshineObservation } from '../entities/Sunshine';
import { WeatherProvider } from '../ports/WeatherProvider';
import { FlagProvider } from '../ports/FlagProvider';
import { SunshineProvider } from '../ports/SunshineProvider';
import { PrecipitationNowProvider } from '../ports/PrecipitationNowProvider';
import { BeachForecastProvider } from '../ports/BeachForecastProvider';
import { weatherFromOpenMeteo, withForecastSky } from '../services/skySources';
import { resolveFlagForStations } from '../services/flagAggregation';
import { GetRainNowcast } from './GetRainNowcast';

/**
 * Corrects the observed sky with sunshine evidence. Injected so the domain
 * does not depend on the runner in infrastructure/di that adds clock, mode, metrics
 * and the decision memory shared between the listing and the detail.
 */
export type SkyCorrector = (
  beachName: string,
  weather: Weather | null,
  sunshine: readonly SunshineObservation[],
  raining: boolean,
  now: number,
  outlook: readonly HourlyOutlookSlot[] | null | undefined,
) => Weather | null;

export interface BeachConditionsNow {
  /**
   * OpenWeather → Open-Meteo → AEMET's station with today's forecast sky
   * (`previsto`) → AEMET's station with no sky; sky already corrected.
   */
  weather: Weather | null;
  /** Aggregated RAW reading: whether it is still current is each caller's policy. */
  flag: FlagStatus | null;
  rain: RainNowcast | null;
}

/**
 * The conditions at a beach right now, for every screen that shows them.
 *
 * The ranking and the detail each used to build this on their own, with the
 * weather fallback and the flag aggregation copy-pasted and the sky correction
 * reached through two different paths. One module means one place where the
 * card and the header of the same beach can disagree, instead of two.
 *
 * Every source is fail-safe: a provider down leaves its field null (or the
 * sky uncorrected), never the whole answer.
 */
export class BeachConditions {
  constructor(
    private readonly aemet: WeatherProvider,
    private readonly openWeather: WeatherProvider,
    private readonly flags: FlagProvider,
    private readonly rainNowcast: GetRainNowcast,
    /** Optional: without it the sky corrector gets no evidence and changes nothing. */
    private readonly sunshine: SunshineProvider | undefined,
    private readonly skyCorrectionEnabled: () => boolean,
    private readonly correctSky: SkyCorrector,
    /** Optional stand-ins for the sky, in order, when OpenWeather has nothing. */
    private readonly openMeteo?: PrecipitationNowProvider,
    private readonly aemetForecast?: BeachForecastProvider,
  ) {}

  async now(beach: Beach): Promise<BeachConditionsNow> {
    const [weather, flag, rain, sol] = await Promise.all([
      this.getWeather(beach),
      this.flagNow(beach),
      this.getRainSafe(beach.latitude, beach.longitude),
      this.getSunshineSafe(beach.latitude, beach.longitude),
    ]);

    return {
      // Corrected at the source and not at render time: description, icon,
      // ranking reason and score all come from here, so they cannot end up
      // contradicting each other.
      weather: this.correctSky(
        beach.name,
        weather,
        sol,
        rain?.status === 'raining',
        Date.now(),
        rain?.outlook,
      ),
      flag,
      rain,
    };
  }

  /** The beach's flag reading right now (aggregated, RAW). Cheap: file + cache. */
  flagNow(beach: Beach): Promise<FlagStatus | null> {
    return resolveFlagForStations(beach.flagRef, beach.flagStations, (ref) => this.getFlagSafe(ref));
  }

  /**
   * Throws if the sunshine source is down. A provider outage is not the same
   * as a valid response without a nearby station: the ranking probes once
   * before its fan-out so a refresh during an outage is rejected and the last
   * corrected ranking keeps being served. The request is cached, so the
   * probe adds no HTTP call.
   */
  async probeSunshine(beach: Beach): Promise<void> {
    if (!this.sunshine || !this.skyCorrectionEnabled()) return;
    await this.sunshine.getSunshineNear(beach.latitude, beach.longitude);
  }

  /**
   * OpenWeather first (reliable, consistent across beaches). Then Open-Meteo's
   * reading, which rides in a call the rain already makes. Then AEMET's
   * station, whose sky can only be the day's FORECAST, labelled as such, and
   * otherwise none: a station measures no sky, and the one it used to carry
   * was made up from temperature and humidity (10-oct-2026). Each step reads
   * a cache with a stale window, so a provider down for a while still answers
   * with its last good reading before the next step is tried.
   */
  private async getWeather(beach: Beach): Promise<Weather | null> {
    const { latitude: lat, longitude: lon } = beach;
    try {
      return await this.openWeather.getCurrentByCoords(lat, lon);
    } catch { /* next source */ }

    if (this.openMeteo) {
      try {
        const weather = weatherFromOpenMeteo(await this.openMeteo.getPrecipitationNow(lat, lon));
        if (weather) return weather;
      } catch { /* next source */ }
    }

    try {
      const station = await this.aemet.getCurrentByCoords(lat, lon);
      return withForecastSky(station, await this.forecastSkyToday(beach));
    } catch {
      return null;
    }
  }

  private async forecastSkyToday(beach: Beach): Promise<string | null> {
    if (!this.aemetForecast || beach.sinAemet) return null;
    try {
      return (await this.aemetForecast.getByBeachCode(beach.aemetCode)).today.summary;
    } catch {
      return null;
    }
  }

  private async getFlagSafe(ref?: FlagRef): Promise<FlagStatus | null> {
    if (!ref) return null;
    try {
      return await this.flags.getFlag(ref);
    } catch {
      return null;
    }
  }

  private async getRainSafe(lat: number, lon: number): Promise<RainNowcast | null> {
    try {
      return await this.rainNowcast.execute(lat, lon);
    } catch {
      return null;
    }
  }

  private async getSunshineSafe(lat: number, lon: number): Promise<SunshineObservation[]> {
    if (!this.sunshine || !this.skyCorrectionEnabled()) return [];
    try {
      return await this.sunshine.getSunshineNear(lat, lon);
    } catch {
      return [];
    }
  }
}
