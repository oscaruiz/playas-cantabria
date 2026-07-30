import { FlagStatus, FlagColor, FlagRef, FlagStation } from '../entities/Flag';

/**
 * Flag aggregation rule for a beach with SEVERAL lifeguard stations.
 *
 * Deterministic and CONSERVATIVE: the MOST RESTRICTIVE flag among the stations
 * with an actual color hoisted is shown. Severity (higher = more restrictive):
 *   black (4) > red (3) > yellow (2) > green (1)
 *
 * Principles:
 *  - A station WITHOUT a color (no coverage / "no hay información") does NOT
 *    count as green: it cannot lower nor "approve" the flag. It simply
 *    contributes no color.
 *  - Individual states are kept by the caller if it needs them; this function
 *    only decides the aggregated flag to display.
 *  - If NO station has a color, the first state with coverage/schedule is
 *    returned (better than nothing), or null if there is none.
 */
const SEVERITY: Record<Exclude<FlagColor, 'unknown'>, number> = {
  green: 1,
  yellow: 2,
  red: 3,
  black: 4,
};

export function aggregateFlags(flags: Array<FlagStatus | null>): FlagStatus | null {
  const present = flags.filter((f): f is FlagStatus => f != null);
  if (present.length === 0) return null;

  const withColor = present.filter(
    (f): f is FlagStatus & { color: Exclude<FlagColor, 'unknown'> } =>
      f.color != null && f.color !== 'unknown'
  );

  if (withColor.length === 0) {
    // No station with a hoisted flag: return the most informative state
    // (with coverage/schedule) to preserve the surveillance information.
    return present.find((f) => f.coverageFrom || f.schedule) ?? present[0];
  }

  // Station with the most restrictive flag (tiebreaker: the most recent one).
  return withColor.reduce((worst, cur) => {
    const dSev = SEVERITY[cur.color] - SEVERITY[worst.color];
    if (dSev > 0) return cur;
    if (dSev === 0 && cur.timestamp > worst.timestamp) return cur;
    return worst;
  });
}

/**
 * Resolves a beach's flag from its stations:
 *  - several stations with a reference → queries all of them (getFlag, already safe) and aggregates.
 *  - otherwise, uses the primary reference `flagRef` (legacy single-flag path).
 * `getFlag` must be a function that does NOT throw (returns null on failure).
 */
export async function resolveFlagForStations(
  primaryRef: FlagRef | undefined,
  stations: FlagStation[] | undefined,
  getFlag: (ref: FlagRef) => Promise<FlagStatus | null>,
): Promise<FlagStatus | null> {
  const refs = (stations ?? [])
    .map((s) => s.ref)
    .filter((r): r is FlagRef => r != null);

  if (refs.length > 0) {
    return aggregateFlags(await Promise.all(refs.map((r) => getFlag(r))));
  }
  if (primaryRef) return getFlag(primaryRef);
  return null;
}
