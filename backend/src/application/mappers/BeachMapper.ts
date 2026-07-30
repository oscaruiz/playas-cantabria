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
      // The public DTO keeps the Cruz Roja vocabulary (frontend contract);
      // refs from other providers do not surface through these two fields.
      idCruzRoja: beach.flagRef?.provider === 'cruzroja' ? beach.flagRef.ref : 0,
      ...(beach.flagStations
        ? {
            cruzRojaStations: beach.flagStations.map((s) => ({
              // sourceId is the catalog's literal id (0 = pending station):
              // it must round-trip verbatim, queryable or not.
              ...(typeof s.sourceId === 'number' ? { id: s.sourceId } : {}),
              nombreFuente: s.sourceName,
            })),
          }
        : {}),
      ...(beach.alias ? { alias: beach.alias } : {}),
      ...(beach.sectores ? { sectores: beach.sectores } : {}),
      ...(beach.sinAemet ? { sinAemet: true } : {}),
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
      ...(beach.webcam ? { webcam: beach.webcam } : {}),
    };
  }

  static toDTOList(beaches: Beach[]): BeachDTO[] {
    return beaches.map(this.toDTO);
  }
}
