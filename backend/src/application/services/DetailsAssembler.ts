import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { BeachDTO } from '../dtos/BeachDTO';
import { BeachMapper } from '../mappers/BeachMapper';

export class DetailsAssembler {
  constructor(
    private readonly getBeachDetails: GetBeachDetails
  ) {}

  async getBeachWithDetails(beachId: string): Promise<BeachDTO> {
    const beachDetails = await this.getBeachDetails.execute(beachId);
    return {
      nombre: beachDetails.beach.name,
      municipio: beachDetails.beach.municipality,
      codigo: beachDetails.beach.aemetCode,
      lat: beachDetails.beach.latitude,
      lon: beachDetails.beach.longitude,
      idCruzRoja: beachDetails.beach.redCrossId || 0,
      // Add weather and flag details if available
      ...(beachDetails.weather && {
        clima: {
          source: beachDetails.weather.source,
          timestamp: beachDetails.weather.timestamp,
          temperatura: beachDetails.weather.temperatureC,
          viento: beachDetails.weather.windSpeedMs,
          direccionViento: beachDetails.weather.windDirectionDeg,
          humedad: beachDetails.weather.humidityPct,
          presion: beachDetails.weather.pressureHPa,
          descripcion: beachDetails.weather.description,
          icono: beachDetails.weather.icon,
        }
      }),
      ...(beachDetails.flag && {
        bandera: String(beachDetails.flag)
      })
    };
  }
}
