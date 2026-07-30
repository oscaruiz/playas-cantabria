import { FlagStatus, FlagRef } from '../entities/Flag';

export interface FlagProvider {
  /**
   * Resolve the current flag for a provider-specific reference.
   * Return null when not available; throw on hard failures.
   */
  getFlag(ref: FlagRef): Promise<FlagStatus | null>;
}
