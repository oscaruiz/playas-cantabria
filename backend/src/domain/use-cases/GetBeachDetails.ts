import { Beach } from '../entities/Beach';
import { BeachRepository } from '../ports/BeachRepository';
import { BeachConditions, BeachConditionsNow } from './BeachConditions';
import { DayWindowSignal } from './BeachWindowScorer';
import { GetFeaturedBeaches } from './GetFeaturedBeaches';

export interface BeachDetails extends BeachConditionsNow {
  beach: Beach;
  /**
   * The ranking's day window for this beach when the conditions came from the
   * ranking; undefined when they were computed here (no ranking in force).
   */
  ventanaDia?: DayWindowSignal | null;
  /** When the ranking these conditions come from was assembled; null if computed here. */
  rankingGeneradoEn?: number | null;
}

export class DetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetailsError';
  }
}

/**
 * A beach plus its conditions right now. The flag is the RAW reading: the
 * detail shows the schedule and the last recorded colour outside lifeguard
 * hours, so it is not filtered here.
 *
 * The conditions are the ranking's own entry for the beach whenever there is
 * a ranking in force. Building them again here, even through the same module,
 * asked the providers at a different instant: once the sky refreshed between
 * the two, the card on the front page and the detail one tap away told two
 * different stories. Only with no ranking yet (cold start) are they computed
 * here, and the client reconciles once the ranking lands.
 *
 * Except the FLAG, read now every time. It is safety data and the reading is
 * cheap (file + cache): a red hoisted after the ranking was assembled must not
 * wait behind a ranking served stale for up to an hour (found by Codex). The
 * card judges the same raw reading at serve time, so the two agree except in
 * the minutes between a new reading and the next ranking refresh.
 */
export class GetBeachDetails {
  constructor(
    private readonly beachRepo: BeachRepository,
    private readonly conditions: BeachConditions,
    /** Optional: without it every detail computes its own conditions. */
    private readonly ranking?: GetFeaturedBeaches,
  ) {}

  async execute(id: string): Promise<BeachDetails> {
    const beach = await this.beachRepo.getById(id);
    if (!beach) {
      throw new DetailsError(`Beach with id '${id}' not found`);
    }

    const snapshot = this.ranking?.snapshotFor(beach.id);
    if (snapshot) {
      const { entry, generadoEn } = snapshot;
      return {
        beach,
        weather: entry.weather,
        flag: await this.conditions.flagNow(beach),
        rain: entry.rain ?? null,
        ventanaDia: entry.ventanaDia ?? null,
        rankingGeneradoEn: generadoEn,
      };
    }
    return { beach, ...(await this.conditions.now(beach)), rankingGeneradoEn: null };
  }
}
