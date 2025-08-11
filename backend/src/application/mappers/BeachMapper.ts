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
      codigo: beach.aemetCode, // public id mirrors AEMET 'codigo'
      lat: beach.latitude,
      lon: beach.longitude,
      idCruzRoja: beach.redCrossId ?? 0,
    };
  }

  static toDTOList(beaches: Beach[]): BeachDTO[] {
    return beaches.map(this.toDTO);
  }
}
