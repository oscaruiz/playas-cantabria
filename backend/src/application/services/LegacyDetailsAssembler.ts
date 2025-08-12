import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { LegacyDetailsDTO, LegacyDetailsMapper } from '../mappers/LegacyDetailsMapper';
import { OpenWeatherWeatherProvider } from '../../infrastructure/providers/OpenWeatherWeatherProvider';

/**
 * Legacy details assembler:
 * - "hoy" respeta la política AEMET→OpenWeather del use-case.
 * - "manana" SIEMPRE se calcula con OpenWeather /forecast (best-effort).
 */
export class LegacyDetailsAssembler {
  constructor(
    private readonly getDetails: GetBeachDetails,
    private readonly openWeather: OpenWeatherWeatherProvider
  ) {}

  async assemble(beachId: string): Promise<LegacyDetailsDTO> {
    const details = await this.getDetails.execute(beachId);
    const base = LegacyDetailsMapper.toDTO(details);

    try {
      const owTomorrow = await this.openWeather.getTomorrowByCoords(
        details.beach.latitude,
        details.beach.longitude
      );

      const guessWind = (ms: number | null) => {
        if (ms == null) return null;
        if (ms < 3) return 'calma';
        if (ms < 6) return 'flojo';
        if (ms < 10) return 'moderado';
        if (ms < 15) return 'fresco';
        return 'fuerte';
      };
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

      const manana = {
        summary: owTomorrow.description
          ? owTomorrow.description.charAt(0).toUpperCase() + owTomorrow.description.slice(1)
          : null,
        temperature: owTomorrow.temperatureC,
        waterTemperature: null,
        sensation:
          owTomorrow.temperatureC == null
            ? null
            : owTomorrow.temperatureC < 10
            ? 'frío'
            : owTomorrow.temperatureC < 18
            ? 'templado'
            : owTomorrow.temperatureC < 26
            ? 'agradable'
            : owTomorrow.temperatureC < 32
            ? 'calor moderado'
            : 'calor intenso',
        wind: guessWind(owTomorrow.windSpeedMs),
        waves: null,
        uvIndex: null,
        icon: mapIcon(owTomorrow.icon),
      };

      if (base.clima) {
        base.clima = { ...base.clima, manana };
      } else {
        base.clima = {
          fuente: 'OpenWeather',
          ultimaActualizacion: new Date(owTomorrow.timestamp).toISOString(),
          hoy: manana,
          manana,
        };
      }
    } catch {
      // forecast failed -> keep current value (possibly null)
    }

    return base;
  }
}
