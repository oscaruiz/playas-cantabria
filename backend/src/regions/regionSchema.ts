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
      // Capped because this string is compiled into a RegExp below: it is the
      // one place where contributed data becomes executable behaviour, and a
      // pathological pattern would hang catalog validation. A real safe-pattern
      // check belongs in the contribution validator (plan, phase 5).
      nombrePattern: z.string().min(1).max(200),
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
