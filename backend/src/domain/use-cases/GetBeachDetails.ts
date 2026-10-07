import { Beach } from '../entities/Beach';
import { BeachRepository } from '../ports/BeachRepository';
import { BeachConditions, BeachConditionsNow } from './BeachConditions';

export interface BeachDetails extends BeachConditionsNow {
  beach: Beach;
}

export class DetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetailsError';
  }
}

/**
 * A beach plus its conditions right now, from the same module the ranking
 * uses, so the card and the header of one beach are built the same way. The
 * flag is the RAW reading: the detail shows the schedule and the last
 * recorded colour outside lifeguard hours, so it is not filtered here.
 */
export class GetBeachDetails {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly conditions: BeachConditions,
  ) {}

  async execute(id: string): Promise<BeachDetails> {
    const beach = await this.beachRepo.getById(id);
    if (!beach) {
      throw new DetailsError(`Beach with id '${id}' not found`);
    }
    return { beach, ...(await this.conditions.now(beach)) };
  }
}
