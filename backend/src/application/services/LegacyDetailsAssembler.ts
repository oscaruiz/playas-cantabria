import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import {
  LegacyDetailsDTO,
  LegacyDetailsMapper,
  ClimaDTO,
  ClimaDiaDTO,
  PrediccionCompletaDTO,
} from '../mappers/LegacyDetailsMapper';
import { OpenWeatherWeatherProvider } from '../../infrastructure/providers/OpenWeatherWeatherProvider';
import { AemetBeachForecastProvider } from '../../infrastructure/providers/AemetBeachForecastProvider';
import { AemetBeachWebScraper } from '../../infrastructure/providers/AemetBeachWebScraper';
import type { BeachFullForecast } from '../../domain/entities/BeachForecast';

/**
 * Legacy details assembler — fallback chain:
 *   Layer 1: AemetBeachWebScraper    (3 days, morning/afternoon, tides, warnings — no API key)
 *   Layer 2: AemetBeachForecastProvider (2 days, OpenData API — requires API key)
 *   Layer 3: OpenWeatherWeatherProvider (temp, wind, desc)
 *   Layer 4: GetBeachDetails use-case  (hedged AEMET API + OpenWeather + Cruz Roja flag)
 */
export class LegacyDetailsAssembler {
  constructor(
    private readonly getDetails: GetBeachDetails,
    private readonly aemetScraper: AemetBeachWebScraper,
    private readonly aemetPlayas: AemetBeachForecastProvider,
    private readonly openWeather: OpenWeatherWeatherProvider,
  ) {}

  // -----------------------------------------------------------------------
  // Icon mapping
  // -----------------------------------------------------------------------

  private legacyIconFromSummary(summary: string | null): number | null {
    if (!summary) return null;
    const s = summary.toLowerCase();
    if (/(despejado|soleado)/.test(s)) return 100;
    if (/(poco\s*nuboso|intervalos|parcial|claro)/.test(s)) return 110;
    if (/(nuboso|nublado|muy nuboso|cubierto)/.test(s)) return 120;
    if (/(llovizna|chubasc|lluvia)/.test(s)) return 200;
    if (/(tormenta|electrica|rayos)/.test(s)) return 210;
    if (/(nieve|nevada|aguanieve)/.test(s)) return 300;
    if (/(niebla|bruma|neblina)/.test(s)) return 400;
    return null;
  }

  // -----------------------------------------------------------------------
  // Helpers shared across fallback layers
  // -----------------------------------------------------------------------

  private wavesFromWind(windMs: number | null): string | null {
    if (windMs == null) return null;
    const kmh = windMs * 3.6;
    if (kmh > 20) return 'agitado';
    if (kmh > 10) return 'moderado';
    return 'tranquilo';
  }

  private sensationFromTemp(t: number | null): string | null {
    if (t == null) return null;
    if (t < 10) return 'frío';
    if (t < 18) return 'templado';
    if (t < 26) return 'agradable';
    if (t < 32) return 'calor moderado';
    return 'calor intenso';
  }

  private guessWind(ms: number | null): string | null {
    if (ms == null) return null;
    if (ms < 3) return 'calma';
    if (ms < 6) return 'flojo';
    if (ms < 10) return 'moderado';
    if (ms < 15) return 'fresco';
    return 'fuerte';
  }

  // -----------------------------------------------------------------------
  // Build clima from scraper forecast (Layer 1)
  // -----------------------------------------------------------------------

  private buildClimaFromForecast(forecast: BeachFullForecast): ClimaDTO {
    const mapDay = (dayIdx: number): ClimaDiaDTO => {
      const day = forecast.days[dayIdx];
      if (!day) {
        return {
          summary: null, temperature: null, waterTemperature: null,
          sensation: null, wind: null, waves: null, uvIndex: null, icon: null,
        };
      }
      return {
        summary: day.morning.skyDescription ?? day.afternoon.skyDescription ?? null,
        temperature: day.maxTemperatureC,
        waterTemperature: day.waterTemperatureC,
        sensation: day.thermalSensation,
        wind: day.morning.wind ?? day.afternoon.wind ?? null,
        waves: day.morning.waves ?? day.afternoon.waves ?? null,
        uvIndex: day.uvIndexMax,
        icon: this.legacyIconFromSummary(day.morning.skyDescription),
      };
    };

    return {
      fuente: 'AEMET',
      ultimaActualizacion: forecast.elaboration ?? new Date().toISOString(),
      hoy: mapDay(0),
      manana: forecast.days.length > 1 ? mapDay(1) : null,
    };
  }

  // -----------------------------------------------------------------------
  // Build clima from AEMET Playas API (Layer 2)
  // -----------------------------------------------------------------------

  private buildClimaFromAemetPlayas(
    playa: Awaited<ReturnType<AemetBeachForecastProvider['getByBeachCode']>>,
    base: ClimaDTO | null,
  ): ClimaDTO {
    const hoy = playa.today;
    const mananaPlayas = playa.tomorrow;

    const hoyDto: ClimaDiaDTO = {
      summary: hoy.summary ?? base?.hoy.summary ?? null,
      temperature: hoy.temperature ?? base?.hoy.temperature ?? null,
      waterTemperature: hoy.waterTemperature ?? base?.hoy.waterTemperature ?? null,
      sensation: hoy.sensation ?? base?.hoy.sensation ?? null,
      wind: hoy.wind ?? base?.hoy.wind ?? null,
      waves: hoy.waves ?? base?.hoy.waves ?? null,
      uvIndex: hoy.uvIndex ?? base?.hoy.uvIndex ?? null,
      icon: this.legacyIconFromSummary(hoy.summary) ?? base?.hoy.icon ?? null,
    };

    let mananaDto: ClimaDiaDTO | null = null;
    if (mananaPlayas) {
      mananaDto = {
        summary: mananaPlayas.summary ?? base?.manana?.summary ?? null,
        temperature: mananaPlayas.temperature ?? base?.manana?.temperature ?? null,
        waterTemperature: mananaPlayas.waterTemperature ?? base?.manana?.waterTemperature ?? null,
        sensation: mananaPlayas.sensation ?? base?.manana?.sensation ?? null,
        wind: mananaPlayas.wind ?? base?.manana?.wind ?? null,
        waves: mananaPlayas.waves ?? base?.manana?.waves ?? null,
        uvIndex: mananaPlayas.uvIndex ?? base?.manana?.uvIndex ?? null,
        icon: this.legacyIconFromSummary(mananaPlayas.summary) ?? base?.manana?.icon ?? null,
      };
    }

    return base
      ? { ...base, hoy: { ...base.hoy, ...hoyDto }, manana: mananaDto ?? base.manana }
      : { fuente: 'AEMET', ultimaActualizacion: playa.lastUpdatedIso, hoy: hoyDto, manana: mananaDto };
  }

  // -----------------------------------------------------------------------
  // Map forecast → prediccionCompleta DTO
  // -----------------------------------------------------------------------

  private mapForecastToDTO(forecast: BeachFullForecast): PrediccionCompletaDTO {
    const mapHalf = (h: BeachFullForecast['days'][number]['morning']) => ({
      cielo: h.skyDescription,
      iconoCielo: h.skyIconCode,
      viento: h.wind,
      oleaje: h.waves,
    });

    return {
      fuente: forecast.source,
      elaboracion: forecast.elaboration,
      zonaAvisos: forecast.warningZone,
      dias: forecast.days.map((d) => ({
        fecha: d.date,
        manana: mapHalf(d.morning),
        tarde: mapHalf(d.afternoon),
        temperaturaMaxima: d.maxTemperatureC,
        sensacionTermica: d.thermalSensation,
        temperaturaAgua: d.waterTemperatureC,
        indiceUV: d.uvIndexMax,
        nivelUV: d.uvLevel,
        aviso: d.warning
          ? { nivel: d.warning.level, descripcion: d.warning.description }
          : null,
      })),
      mareas: forecast.tides.map((t) => ({
        pleamar: t.highTide,
        bajamar: t.lowTide,
      })),
      fuenteMareas: forecast.tidesSource,
    };
  }

  // -----------------------------------------------------------------------
  // Main assemble
  // -----------------------------------------------------------------------

  async assemble(beachId: string): Promise<LegacyDetailsDTO> {
    // Step 1: Base data from use-case (hedged weather + Cruz Roja flag)
    const details = await this.getDetails.execute(beachId);
    let base = LegacyDetailsMapper.toDTO(details);

    // Step 2: Try scraper (Layer 1 — richest source)
    let forecast: BeachFullForecast | null = null;
    try {
      forecast = await this.aemetScraper.getBeachForecast(details.beach.aemetCode);
    } catch {
      // scraper failed, forecast stays null
    }

    // Step 3: Build clima (backward-compatible)
    if (forecast && forecast.days.length > 0) {
      // Layer 1: scraper succeeded
      base.clima = this.buildClimaFromForecast(forecast);
    } else {
      // Layer 2: AEMET Playas API
      try {
        if (details.beach.aemetCode) {
          const playa = await this.aemetPlayas.getByBeachCode(details.beach.aemetCode);
          base.clima = this.buildClimaFromAemetPlayas(playa, base.clima);
        }
      } catch {
        // Layer 3: base.clima already has OpenWeather/AEMET hedged data from use-case
      }
    }

    // Step 4: Enrich manana with OpenWeather forecast if still missing
    try {
      const owTomorrow = await this.openWeather.getTomorrowByCoords(
        details.beach.latitude,
        details.beach.longitude,
      );
      const mapIcon = (icon: string | null) => {
        if (!icon) return null;
        if (icon.startsWith('01')) return 100;
        if (icon.startsWith('02')) return 110;
        if (icon.startsWith('03') || icon.startsWith('04')) return 120;
        if (icon.startsWith('09') || icon.startsWith('10')) return 200;
        if (icon.startsWith('11')) return 210;
        if (icon.startsWith('13')) return 300;
        if (icon.startsWith('50')) return 400;
        return null;
      };

      const existing = base.clima?.manana ?? null;
      const owSummary = owTomorrow.description
        ? owTomorrow.description.charAt(0).toUpperCase() + owTomorrow.description.slice(1)
        : null;

      const chosenTemp = existing?.temperature ?? owTomorrow.temperatureC ?? null;

      const manana: ClimaDiaDTO = {
        summary: existing?.summary ?? owSummary ?? null,
        temperature: chosenTemp,
        waterTemperature: existing?.waterTemperature ?? null,
        sensation: existing?.sensation ?? this.sensationFromTemp(chosenTemp),
        wind: existing?.wind ?? this.guessWind(owTomorrow.windSpeedMs),
        waves: existing?.waves ?? this.wavesFromWind(owTomorrow.windSpeedMs),
        uvIndex: existing?.uvIndex ?? null,
        icon: existing?.icon ?? mapIcon(owTomorrow.icon) ?? null,
      };

      base.clima = base.clima
        ? { ...base.clima, manana }
        : {
            fuente: 'OpenWeather',
            ultimaActualizacion: new Date(owTomorrow.timestamp).toISOString(),
            hoy: manana,
            manana,
          };
    } catch {
      // forecast failed -> keep current value
    }

    // Step 5: UV enrichment (OneCall + cloudiness estimation)
    if (base.clima) {
      let hoyUv: number | null = base.clima.hoy.uvIndex ?? null;
      let mananaUv: number | null = base.clima.manana ? base.clima.manana.uvIndex ?? null : null;

      try {
        const uv = await this.openWeather.getDailyUVIndex(details.beach.latitude, details.beach.longitude);
        hoyUv = hoyUv ?? uv.today ?? null;
        mananaUv = base.clima.manana ? (mananaUv ?? uv.tomorrow ?? null) : null;
      } catch {}

      if (hoyUv == null || (base.clima.manana && mananaUv == null)) {
        try {
          const clouds = await this.openWeather.getCloudinessTodayAndTomorrow(
            details.beach.latitude,
            details.beach.longitude,
          );
          const est = (c: number | null) => {
            if (c == null) return null;
            return Math.max(1, Math.round(10 * (1 - c / 100)));
          };
          hoyUv = hoyUv ?? est(clouds.today);
          mananaUv = base.clima.manana ? (mananaUv ?? est(clouds.tomorrow)) : null;
        } catch {}
      }

      const hoy = { ...base.clima.hoy, uvIndex: hoyUv };
      const manana = base.clima.manana ? { ...base.clima.manana, uvIndex: mananaUv } : null;
      base.clima = { ...base.clima, hoy, manana };
    }

    // Step 6: Derive waves from wind if still missing
    try {
      if (base.clima && !base.clima.hoy.waves) {
        const waves = this.wavesFromWind(details.weather?.windSpeedMs ?? null);
        if (waves) {
          base.clima = { ...base.clima, hoy: { ...base.clima.hoy, waves } };
        }
      }
    } catch {}

    // Step 7: Water temperature fallback
    try {
      const DEFAULT_WATER_TEMP = 22;
      if (base.clima) {
        const hoyWT = base.clima.hoy.waterTemperature ?? DEFAULT_WATER_TEMP;
        const mananaWT = base.clima.manana ? (base.clima.manana.waterTemperature ?? DEFAULT_WATER_TEMP) : null;
        base.clima = {
          ...base.clima,
          hoy: { ...base.clima.hoy, waterTemperature: hoyWT },
          manana: base.clima.manana ? { ...base.clima.manana, waterTemperature: mananaWT } : null,
        };
      }
    } catch {}

    // Step 8: prediccionCompleta (only when scraper succeeded)
    base.prediccionCompleta = forecast ? this.mapForecastToDTO(forecast) : null;

    // Step 9: If scraper failed entirely, try to recover tides from long-lived cache
    if (!base.prediccionCompleta) {
      const cached = this.aemetScraper.getCachedTides(details.beach.aemetCode);
      if (cached && cached.tides.length > 0) {
        base.prediccionCompleta = {
          fuente: 'AEMET_HTML',
          elaboracion: null,
          zonaAvisos: null,
          dias: [],
          mareas: cached.tides.map((t) => ({
            pleamar: t.highTide,
            bajamar: t.lowTide,
          })),
          fuenteMareas: cached.tidesSource,
        };
      }
    }

    return base;
  }
}
