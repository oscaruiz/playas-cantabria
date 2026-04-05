import { BeachAttributesDTO } from './BeachDTO';

export interface FeaturedBeachDTO {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  temperatura: number | null;
  descripcionClima: string | null;
  iconoClima: string | null;
  vientoMs: number | null;
  bandera: 'Verde' | 'Amarilla' | 'Roja' | null;
  puntuacion: number;
  razonRanking: string;
  atributos: BeachAttributesDTO | null;
}

export interface FeaturedBeachesResponseDTO {
  timestamp: number;
  playas: FeaturedBeachDTO[];
  revisar: FeaturedBeachDTO[];
  resumenTodas: FeaturedBeachDTO[];
}
