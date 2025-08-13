export type FlagColor = 'green' | 'yellow' | 'red' | 'black' | 'unknown';

export interface FlagStatus {
  color: FlagColor;
  /** Optional human message scraped/provided by the source. */
  message?: string;
  /** Unix epoch (ms) when the flag info was observed. */
  timestamp: number;
  /** Optional Cruz Roja details */
  coverageFrom?: string | null;
  coverageTo?: string | null;
  schedule?: string | null;
}
