import { Beach } from '../entities/Beach';

export interface BeachRepository {
  getAll(): Promise<Beach[]>;
  getById(id: string): Promise<Beach | null>;
}
