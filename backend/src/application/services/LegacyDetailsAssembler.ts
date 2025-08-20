import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { LegacyDetailsDTO, LegacyDetailsMapper } from '../mappers/LegacyDetailsMapper';
import { OpenWeatherWeatherProvider } from '../../infrastructure/providers/OpenWeatherWeatherProvider';
import { AemetBeachForecastProvider } from '../../infrastructure/providers/AemetBeachForecastProvider';

/**
 * Legacy details assembler:
 * - "hoy" respeta la política AEMET→OpenWeather del use-case.
 * - "manana" se complementa con OpenWeather /forecast.
 * - Además, si hay predicción específica de AEMET para playa, se usa para
 *   rellenar waterTemperature, waves y uvIndex (y mejores summary/icon).
 */
export class LegacyDetailsAssembler {
  constructor(
    private readonly getDetails: GetBeachDetails,
    private readonly openWeather: OpenWeatherWeatherProvider,
    private readonly aemetPlayas: AemetBeachForecastProvider
  ) {}

  private legacyIconFromSummary(summary: string | null): number | null {
    if (!summary) return null;
    const s = summary.toLowerCase();
    if (/(despejado|soleado)/.test(s)) return 100; // 01
    if (/(poco\s*nuboso|intervalos|parcial|claro)/.test(s)) return 110; // 02
    if (/(nuboso|nublado|muy nuboso|cubierto)/.test(s)) return 120; // 03/04
    if (/(llovizna|chubasc|lluvia)/.test(s)) return 200; // 09/10
    if (/(tormenta|electrica|rayos)/.test(s)) return 210; // 11
    if (/(nieve|nevada|aguanieve)/.test(s)) return 300; // 13
    if (/(niebla|bruma|neblina)/.test(s)) return 400; // 50
    return null;
  }

  async assemble(beachId: string): Promise<LegacyDetailsDTO> {
    const details = await this.getDetails.execute(beachId);
    let base = LegacyDetailsMapper.toDTO(details);

    // helper to derive waves from wind speed (m/s)
    const wavesFromWind = (windMs: number | null): string | null => {
      if (windMs == null) return null;
      const kmh = windMs * 3.6;
      if (kmh > 20) return 'agitado';
      if (kmh > 10) return 'moderado';
      return 'tranquilo';
    };

    // 1) Enriquecer con AEMET Playas (si hay código AEMET válido)
    try {
      if (details.beach.aemetCode) {
        const playa = await this.aemetPlayas.getByBeachCode(details.beach.aemetCode);
        const hoy = playa.today;
        const mananaPlayas = playa.tomorrow;
        if (hoy) {
          const hoyDto = {
            summary: hoy.summary ?? base.clima?.hoy.summary ?? null,
            temperature: hoy.temperature ?? base.clima?.hoy.temperature ?? null,
            waterTemperature: hoy.waterTemperature ?? base.clima?.hoy.waterTemperature ?? null,
            sensation:
              hoy.sensation ?? base.clima?.hoy.sensation ?? (base.clima?.hoy.temperature != null
                ? base.clima?.hoy.sensation
                : null),
            wind: hoy.wind ?? base.clima?.hoy.wind ?? null,
            waves: hoy.waves ?? base.clima?.hoy.waves ?? null,
            uvIndex: hoy.uvIndex ?? base.clima?.hoy.uvIndex ?? null,
            icon: this.legacyIconFromSummary(hoy.summary) ?? base.clima?.hoy.icon ?? null,
          };

          base.clima = base.clima
            ? { ...base.clima, hoy: { ...base.clima.hoy, ...hoyDto } }
            : {
                fuente: 'AEMET',
                ultimaActualizacion: playa.lastUpdatedIso,
                hoy: hoyDto,
                manana: null,
              };

          if (mananaPlayas) {
            const mananaDto = {
              summary: mananaPlayas.summary ?? base.clima?.manana?.summary ?? null,
              temperature: mananaPlayas.temperature ?? base.clima?.manana?.temperature ?? null,
              waterTemperature:
                mananaPlayas.waterTemperature ?? base.clima?.manana?.waterTemperature ?? null,
              sensation:
                mananaPlayas.sensation ?? base.clima?.manana?.sensation ?? null,
              wind: mananaPlayas.wind ?? base.clima?.manana?.wind ?? null,
              waves: mananaPlayas.waves ?? base.clima?.manana?.waves ?? null,
              uvIndex: mananaPlayas.uvIndex ?? base.clima?.manana?.uvIndex ?? null,
              icon: this.legacyIconFromSummary(mananaPlayas.summary) ?? base.clima?.manana?.icon ?? null,
            };
            base.clima = base.clima ? { ...base.clima, manana: mananaDto } : base.clima;
          }
        }
      }
    } catch {
      // si falla AEMET playas, seguimos con lo que haya
    }

    // 2) Completar 'mañana' con OpenWeather forecast si falta
    try {
      const owTomorrow = await this.openWeather.getTomorrowByCoords(
        details.beach.latitude,
        details.beach.longitude
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

      const guessWind = (ms: number | null) => {
        if (ms == null) return null;
        if (ms < 3) return 'calma';
        if (ms < 6) return 'flojo';
        if (ms < 10) return 'moderado';
        if (ms < 15) return 'fresco';
        return 'fuerte';
      };
      const sensationFromTemp = (t: number | null) => {
        if (t == null) return null;
        if (t < 10) return 'frío';
        if (t < 18) return 'templado';
        if (t < 26) return 'agradable';
        if (t < 32) return 'calor moderado';
        return 'calor intenso';
      };

      const chosenTemp = existing?.temperature ?? owTomorrow.temperatureC ?? null;

      const manana = {
        summary: existing?.summary ?? owSummary ?? null,
        temperature: chosenTemp,
        waterTemperature: existing?.waterTemperature ?? null,
        sensation: existing?.sensation ?? sensationFromTemp(chosenTemp),
        wind: existing?.wind ?? guessWind(owTomorrow.windSpeedMs),
        waves: existing?.waves ?? wavesFromWind(owTomorrow.windSpeedMs),
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
      // forecast failed -> keep current value (possibly null)
    }

    // 3) Rellenar UV index (intento OneCall y, si falla o falta, estimación por nubosidad)
    if (base.clima) {
      let hoyUv: number | null = base.clima.hoy.uvIndex ?? null;
      let mananaUv: number | null = base.clima.manana ? base.clima.manana.uvIndex ?? null : null;

      // OneCall
      try {
        const uv = await this.openWeather.getDailyUVIndex(details.beach.latitude, details.beach.longitude);
        hoyUv = hoyUv ?? uv.today ?? null;
        mananaUv = base.clima.manana ? (mananaUv ?? uv.tomorrow ?? null) : null;
      } catch {}

      // Estimación por nubosidad si sigue faltando
      if (hoyUv == null || (base.clima.manana && mananaUv == null)) {
        try {
          const clouds = await this.openWeather.getCloudinessTodayAndTomorrow(details.beach.latitude, details.beach.longitude);
          const est = (c: number | null) => {
            if (c == null) return null;
            const uvEst = Math.max(1, Math.round(10 * (1 - c / 100)));
            return uvEst;
          };
          hoyUv = hoyUv ?? est(clouds.today);
          mananaUv = base.clima.manana ? (mananaUv ?? est(clouds.tomorrow)) : null;
        } catch {}
      }

      const hoy = { ...base.clima.hoy, uvIndex: hoyUv };
      const manana = base.clima.manana ? { ...base.clima.manana, uvIndex: mananaUv } : null;
      base.clima = { ...base.clima, hoy, manana };
    }

    // 4) Derivar oleaje de 'hoy' a partir del viento actual si sigue faltando
    try {
      if (base.clima && !base.clima.hoy.waves) {
        const waves = wavesFromWind(details.weather?.windSpeedMs ?? null);
        if (waves) {
          base.clima = { ...base.clima, hoy: { ...base.clima.hoy, waves } } as any;
        }
      }
    } catch {}

    // 5) Fallback para waterTemperature cuando no lo aporta AEMET Playas
    try {
      const DEFAULT_WATER_TEMP = 22; // media estival Cantábrico
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

    return base;
  }
}
