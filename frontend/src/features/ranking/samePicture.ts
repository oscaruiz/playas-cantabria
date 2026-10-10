import { normalizeInstant } from '../provenance/provenance';

/**
 * What to fetch again so a beach's detail and the ranking on screen are the
 * same picture.
 *
 * The backend builds the detail from the ranking's own entry for the beach
 * and says which one (`rankingGeneradoEn`). The phone can still hold two
 * different generations: the ranking from the front page and a detail fetched
 * later, or the other way round. Whichever is older is asked for again; the
 * card and the detail then show the same sky, flag, rain and window.
 *
 * - `'ranking'`: the detail comes from a newer ranking than the one painted.
 * - `'detail'`: the painted ranking is newer, or the detail was computed
 *   before any ranking existed (`null`).
 * - `'none'`: same picture, no ranking yet, or a backend that predates the
 *   field (`undefined`) and could never settle it.
 */
export function reconcile(
  detailRanking: string | null | undefined,
  paintedRankingMs: number | null,
): 'ranking' | 'detail' | 'none' {
  if (detailRanking === undefined || paintedRankingMs == null) return 'none';
  const detailMs = normalizeInstant(detailRanking);
  if (detailMs == null) return 'detail';
  if (detailMs > paintedRankingMs) return 'ranking';
  if (detailMs < paintedRankingMs) return 'detail';
  return 'none';
}
