import { z } from 'zod';
import type { RegionConfig } from './RegionConfig';

const bboxSchema = z.object({
  latMin: z.number().min(-90).max(90),
  latMax: z.number().min(-90).max(90),
  lonMin: z.number().min(-180).max(180),
  lonMax: z.number().min(-180).max(180),
}).strict().refine(
  (bbox) => bbox.latMin < bbox.latMax && bbox.lonMin < bbox.lonMax,
  'bbox minimums must be lower than maximums',
);

/**
 * `nombrePattern` is the one place where contributed data becomes EXECUTABLE
 * behaviour: it is compiled with `new RegExp` and run against catalog names.
 * Capping its length was not enough — `(a+)+$` is 6 characters and its cost
 * grows exponentially with the input, so a valid-looking contribution could
 * hang `validate:regions`, the CI, or the server's startup.
 *
 * The way out is to forbid what makes backtracking explode instead of trying
 * to detect it: no repetition at all. Exact bounds do not make an ambiguous
 * repeated body safe. What survives — literals,
 * anchors, groups, alternation and a handful of `?` — is exactly what the rule
 * needs ("^(la )?concha( de santander)?$") and its cost is bounded by
 * 2^OPTIONALS paths, which for 8 is nothing.
 */
const MAX_OPTIONALS = 8;
const MAX_ALTERNATIVES = 8;

function assertSafePattern(pattern: string, ctx: z.RefinementCtx): void {
  const reject = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `nombrePattern ${message}` });

  let optionals = 0;
  let alternatives = 0;
  let inCharacterClass = false;

  // Inspect regex syntax instead of using negative lookbehind: the latter
  // mistakes an escaped backslash followed by a quantifier for an escaped
  // quantifier. Exact repetitions are forbidden too: `^(a|aa){40}$` is
  // bounded syntactically but still exhibits catastrophic backtracking.
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '\\') {
      const escaped = pattern[index + 1];
      if (!inCharacterClass && (/[1-9]/.test(escaped ?? '') || (escaped === 'k' && pattern[index + 2] === '<'))) {
        reject('must not use backreferences');
      }
      index += 1;
      continue;
    }
    if (char === '[' && !inCharacterClass) {
      inCharacterClass = true;
      continue;
    }
    if (char === ']' && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (inCharacterClass) continue;

    if (char === '*' || char === '+' || char === '{') {
      reject(`must not use repetition ("${char}"): bounded repetition can also cause catastrophic backtracking`);
    } else if (char === '?') {
      optionals += 1;
    } else if (char === '|') {
      alternatives += 1;
    }
  }

  if (optionals > MAX_OPTIONALS) {
    reject(`must not use more than ${MAX_OPTIONALS} optional groups (found ${optionals})`);
  }
  if (alternatives > MAX_ALTERNATIVES) {
    reject(`must not use more than ${MAX_ALTERNATIVES} alternatives (found ${alternatives})`);
  }
  try {
    new RegExp(pattern);
  } catch (error) {
    reject(`is not a valid regular expression: ${(error as Error).message}`);
  }
}

const rawRegionSchema = z.object({
  $schema: z.string().optional(),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  observationBbox: bboxSchema,
  catalogRules: z.object({
    bbox: bboxSchema,
    regionName: z.string().min(1),
    forbiddenBeaches: z.array(z.object({
      municipio: z.string().min(1),
      nombrePattern: z.string().min(1).max(200).superRefine(assertSafePattern),
    }).strict()),
  }).strict(),
  flagProviders: z.array(z.enum(['cruzroja'])).refine(
    (providers) => new Set(providers).size === providers.length,
    'flag providers must be unique',
  ),
  branding: z.object({
    appName: z.string().min(1),
    shortName: z.string().min(1),
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    capacitorAppId: z.string().regex(/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/),
  }).strict(),
  map: z.object({
    center: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }).strict(),
    zoom: z.number().min(1).max(22),
  }).strict(),
}).strict();

export function parseRegionConfig(input: unknown): Omit<
  RegionConfig,
  'catalogPath' | 'flagsPath' | 'snapshotPath' | 'regionDir'
> {
  const raw = rawRegionSchema.parse(input);
  const { $schema: _schema, ...region } = raw;
  return {
    ...region,
    catalogRules: {
      ...raw.catalogRules,
      forbiddenBeaches: raw.catalogRules.forbiddenBeaches.map((entry) => ({
        municipio: entry.municipio,
        nombre: new RegExp(entry.nombrePattern),
      })),
    },
  };
}
