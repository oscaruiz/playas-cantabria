import { FlagStatus } from '../entities/Flag';

export interface FlagProvider {
  /**
   * If the beach has a Red Cross id (non-zero), return the flag.
   * Return null when not available; throw on hard failures.
   */
  getFlagByRedCrossId(redCrossId: number): Promise<FlagStatus | null>;
}
