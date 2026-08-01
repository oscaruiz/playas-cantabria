/**
 * Shape of `regions/<id>/flags.json`, the file the flag scraper writes and the
 * backend serves when the live scrape is blocked.
 *
 * It exists because the file was the only piece of region data with NO schema:
 * validation checked that `flags` was an object and stopped there, so a corrupt
 * capture — a colour that is not a colour, a key that is not a station, a
 * `generatedAt` in 2099 — went through CI untouched and reached production as
 * silently wrong safety data. A date in the future is the worst of the three:
 * freshness is computed as `now - generatedAt`, so a future capture NEVER
 * expires and the app paints a colour that stopped being true days ago.
 *
 * Read it with `readFlagsFile`: the scripts fail on any issue, the provider
 * drops the bad entries and keeps the good ones (a single broken beach must not
 * take the region's flags down with it).
 */
import { z } from 'zod';

/** Colours the scraper can capture. `null` = station with no flag hoisted. */
export const FLAG_FILE_COLORS = ['green', 'yellow', 'red', 'black'] as const;

/** Clock skew tolerated on `generatedAt` before calling it "the future". */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const entrySchema = z
  .object({
    color: z.enum(FLAG_FILE_COLORS).nullable().optional(),
    message: z.string().nullable().optional(),
    coverageFrom: z.string().nullable().optional(),
    coverageTo: z.string().nullable().optional(),
    schedule: z.string().nullable().optional(),
  })
  .strict();

export type FlagFileEntry = z.infer<typeof entrySchema>;

const fileSchema = z
  .object({
    generatedAt: z.string(),
    flags: z.record(z.string(), z.unknown()),
  })
  .strict();

export interface FlagsFileRead {
  /** Epoch ms of the capture, or null when it is missing, unparseable or ahead of now. */
  generatedAt: number | null;
  /** Valid entries only, keyed by station id. */
  flags: Map<number, FlagFileEntry>;
  errors: string[];
}

export function readFlagsFile(raw: unknown, ahora: Date = new Date()): FlagsFileRead {
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      generatedAt: null,
      flags: new Map(),
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'flags.json'}: ${i.message}`),
    };
  }

  const errors: string[] = [];
  const flags = new Map<number, FlagFileEntry>();

  const generado = Date.parse(parsed.data.generatedAt);
  let generatedAt: number | null = null;
  if (Number.isNaN(generado)) {
    errors.push(`generatedAt "${parsed.data.generatedAt}" is not a parseable date`);
  } else if (generado - ahora.getTime() > TOLERANCIA_FUTURO_MS) {
    errors.push(`generatedAt "${parsed.data.generatedAt}" is in the future: the capture would never expire`);
  } else {
    generatedAt = generado;
  }

  for (const [key, value] of Object.entries(parsed.data.flags)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`flags["${key}"]: station id must be a positive integer`);
      continue;
    }
    const entry = entrySchema.safeParse(value);
    if (!entry.success) {
      errors.push(
        `flags["${key}"]: ${entry.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
      );
      continue;
    }
    flags.set(id, entry.data);
  }

  return { generatedAt, flags, errors };
}
