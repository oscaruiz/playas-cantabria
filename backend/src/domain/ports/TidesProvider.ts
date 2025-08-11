import { Tides } from '../entities/Tides';

export interface TidesProvider {
  getTidesByCoords(lat: number, lon: number): Promise<Tides | null>;
}
