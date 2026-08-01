export type FlagColor = 'green' | 'yellow' | 'red' | 'black' | 'unknown';

export interface FlagStatus {
  color?: FlagColor;
  /** Optional human message scraped/provided by the source. */
  message?: string;
  /** Unix epoch (ms) when the flag info was observed. */
  timestamp: number;
  /** Optional coverage details (hours, dates) as published by the provider. */
  coverageFrom?: string | null;
  coverageTo?: string | null;
  schedule?: string | null;
}

/**
 * Flag data providers wired in the app. Extend this union when a new region
 * brings a different lifeguard operator (e.g. a provincial service).
 */
export type FlagProviderId = 'cruzroja';

/**
 * Public name of each operator, as it must be shown to the user ("watched by
 * X"). It lives here and not in the region files because an operator is the
 * same organisation wherever it works: a region declares WHICH operators it
 * has, never how they are called.
 */
export const FLAG_OPERATOR_NAMES: Record<FlagProviderId, string> = {
  cruzroja: 'Cruz Roja',
};

/** Provider-neutral reference to a flag source. */
export interface FlagRef {
  provider: FlagProviderId;
  /** Provider-specific identifier (Cruz Roja: numeric station id). */
  ref: number;
}

/**
 * A lifeguard station on a physical beach. A beach can have 0, 1 or several
 * stations; flags from stations with a known ref are aggregated conservatively
 * (most restrictive wins — see domain/services/flagAggregation).
 */
export interface FlagStation {
  /** Absent = station known but its provider id not verified yet. */
  ref?: FlagRef;
  /**
   * Raw station id exactly as it appears in the catalog, even when not
   * queryable (0 = pending). Kept separate from `ref` so the public DTO can
   * re-publish it verbatim (contract parity) without the domain treating a
   * non-positive id as a real reference.
   */
  sourceId?: number;
  /** Station name as published by the provider (operational alias). */
  sourceName: string;
}
