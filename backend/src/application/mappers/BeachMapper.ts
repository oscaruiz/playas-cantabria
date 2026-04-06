import { Beach } from '../../domain/entities/Beach';
import { BeachDTO } from '../dtos/BeachDTO';

/**
 * Maps internal Beach entity (English) to public API BeachDTO (Spanish keys).
 */
export class BeachMapper {
  static toDTO(beach: Beach): BeachDTO {
    return {
      nombre: beach.name,
      municipio: beach.municipality,
      codigo: beach.aemetCode,
      lat: beach.latitude,
      lon: beach.longitude,
      idCruzRoja: beach.redCrossId ?? 0,
      ...(beach.attributes ? { atributos: beach.attributes } : {}),
      ...(beach.lengthM != null ? { longitud: beach.lengthM } : {}),
      ...(beach.widthM != null ? { anchura: beach.widthM } : {}),
      ...(beach.beachType ? { tipoPlaya: beach.beachType } : {}),
      ...(beach.sandType ? { arena: beach.sandType } : {}),
      ...(beach.access ? { acceso: beach.access } : {}),
      ...(beach.parkingDescription ? { parkingDescripcion: beach.parkingDescription } : {}),
      ...(beach.busInfo ? { bus: beach.busInfo } : {}),
      ...(beach.hospitalDistanceKm != null ? { hospitalDistancia: beach.hospitalDistanceKm } : {}),
      ...(beach.diving != null ? { submarinismo: beach.diving } : {}),
    };
  }

  static toDTOList(beaches: Beach[]): BeachDTO[] {
    return beaches.map(this.toDTO);
  }
}
