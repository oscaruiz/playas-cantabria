import { Beach } from '../entities/Beach';
import { BeachRepository } from '../ports/BeachRepository';

export class GetAllBeaches {
  constructor(private readonly beachRepo: BeachRepository) {}

  async execute(): Promise<Beach[]> {
    const beaches = await this.beachRepo.getAll();
    // Sorted by name for deterministic output (does not change payload shape).
    return [...beaches].sort((a, b) => a.name.localeCompare(b.name));
  }
}
