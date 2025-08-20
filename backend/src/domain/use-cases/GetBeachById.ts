import { Beach } from '../entities/Beach';
import { BeachRepository } from '../ports/BeachRepository';

export class BeachNotFoundError extends Error {
  constructor(public readonly beachId: string) {
    super(`Beach with id '${beachId}' not found`);
    this.name = 'BeachNotFoundError';
  }
}

export class GetBeachById {
  constructor(private readonly beachRepo: BeachRepository) {}

  async execute(id: string): Promise<Beach> {
    const beach = await this.beachRepo.getById(id);
    if (!beach) {
      throw new BeachNotFoundError(id);
    }
    return beach;
  }
}
