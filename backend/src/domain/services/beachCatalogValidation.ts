import type { FlagProviderId } from '../entities/Flag';
/**
 * Automated validation of a region beach catalog (regions/<id>/beaches.json).
 *
 * PURE function: receives the raw array (Spanish keys) and returns a list of
 * errors (empty = valid catalog). It runs in a test and can be reused in a CI
 * script. No network: it does not check the "vigencia" of an AEMET code on
 * aemet.es (that is verified in the onboarding process), only structural
 * integrity.
 */

export type RawCatalogAttributes = Record<string, unknown>;

export interface RawCatalogBeach {
  nombre?: unknown;
  municipio?: unknown;
  codigo?: unknown;
  lat?: unknown;
  lon?: unknown;
  idCruzRoja?: unknown;
  cruzRojaStations?: Array<{ id?: unknown; nombreFuente?: unknown }>;
  alias?: unknown;
  sectores?: Array<{ nombre?: unknown; longitud?: unknown }>;
  sinAemet?: unknown;
  atributos?: RawCatalogAttributes;
  longitud?: unknown;
  anchura?: unknown;
}

/**
 * Region-specific validation rules. The function itself is region-agnostic;
 * each region provides its own rules (see src/regions/).
 */
export interface CatalogRules {
  /** Reasonable coordinate range for the region's beaches (small margin). */
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  /** Region name used in error messages. */
  regionName: string;
  /**
   * Known-bad entries that must NOT exist in the catalog. Matched against
   * normalized (normalizeName) municipality and beach name.
   */
  forbiddenBeaches: Array<{ municipio: string; nombre: RegExp }>;
}

const KNOWN_ATTRS = new Set([
  'accesoBanista', 'accesible', 'mascotas', 'duchas', 'aseos',
  'parking', 'chiringuito', 'socorrismo', 'nudista', 'surf',
]);

/** lowercase, no accents, no repeated spaces, trim. Does NOT strip articles. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CatalogValidationResult {
  /** Integrity problems that MUST be empty (they break the test). */
  errors: string[];
  /** Suspicious signals to review (they do not break the build; they are reported). */
  warnings: string[];
}

export function validateBeachCatalog(
  beaches: RawCatalogBeach[],
  rules: CatalogRules,
): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, number>();          // codigo -> count
  const nameMuni = new Map<string, number>();      // normalized "nombre|municipio" -> count
  const crIdOwner = new Map<number, string>();     // cruz roja id -> beach codigo
  const aliasOwner = new Map<string, string>();    // normalized alias -> beach codigo

  beaches.forEach((b, i) => {
    const where = typeof b.nombre === 'string' ? `"${b.nombre}"` : `#${i}`;

    // Required fields
    if (typeof b.nombre !== 'string' || !b.nombre.trim()) errors.push(`${where}: nombre inválido`);
    if (typeof b.municipio !== 'string' || !b.municipio.trim()) errors.push(`${where}: municipio inválido`);
    if (typeof b.codigo !== 'string' || !/^\d{7}$/.test(b.codigo)) {
      errors.push(`${where}: codigo (id interno) inválido (se espera 7 dígitos)`);
    }

    // Unique internal id
    if (typeof b.codigo === 'string') ids.set(b.codigo, (ids.get(b.codigo) ?? 0) + 1);

    // Unique normalized nombre+municipio
    if (typeof b.nombre === 'string' && typeof b.municipio === 'string') {
      const key = `${normalizeName(b.nombre)}|${normalizeName(b.municipio)}`;
      nameMuni.set(key, (nameMuni.get(key) ?? 0) + 1);
    }

    // Forbidden entries for the region (known bad entries)
    if (typeof b.nombre === 'string' && typeof b.municipio === 'string') {
      for (const f of rules.forbiddenBeaches) {
        if (normalizeName(b.municipio) === f.municipio && f.nombre.test(normalizeName(b.nombre))) {
          errors.push(`${where}: "${b.nombre}" (${b.municipio}) no debe existir en el catálogo`);
        }
      }
    }

    // Coordinates within range
    const lat = b.lat, lon = b.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
      errors.push(`${where}: coordenadas ausentes o no numéricas`);
    } else if (
      lat < rules.bbox.latMin || lat > rules.bbox.latMax ||
      lon < rules.bbox.lonMin || lon > rules.bbox.lonMax
    ) {
      errors.push(`${where}: coordenadas fuera del rango de ${rules.regionName} (${lat}, ${lon})`);
    }

    // Non-negative longitud/anchura
    for (const [k, v] of [['longitud', b.longitud], ['anchura', b.anchura]] as const) {
      if (v != null && (typeof v !== 'number' || v < 0)) errors.push(`${where}: ${k} negativa o no numérica`);
    }

    // Attributes: only known, boolean keys (never null → prevents "unknown" from becoming false)
    if (b.atributos && typeof b.atributos === 'object') {
      for (const [k, v] of Object.entries(b.atributos)) {
        if (!KNOWN_ATTRS.has(k)) errors.push(`${where}: atributo desconocido "${k}"`);
        if (v !== true && v !== false && v !== undefined) {
          errors.push(`${where}: atributo "${k}" debe ser boolean u omitido (no ${JSON.stringify(v)})`);
        }
      }
    }

    // Cruz Roja ids (idCruzRoja + stations) are not repeated across distinct physical beaches
    const crIds: number[] = [];
    if (typeof b.idCruzRoja === 'number' && b.idCruzRoja > 0) crIds.push(b.idCruzRoja);
    if (Array.isArray(b.cruzRojaStations)) {
      for (const s of b.cruzRojaStations) {
        if (typeof s?.nombreFuente !== 'string' || !s.nombreFuente.trim()) {
          errors.push(`${where}: puesto Cruz Roja sin nombreFuente`);
        }
        if (typeof s?.id === 'number' && s.id > 0) crIds.push(s.id);
        // The station name is also an operational alias → it must resolve to this beach
        if (typeof s?.nombreFuente === 'string' && typeof b.codigo === 'string') {
          registerAlias(aliasOwner, errors, normalizeName(s.nombreFuente), b.codigo, where);
        }
      }
    }
    for (const id of crIds) {
      const owner = crIdOwner.get(id);
      if (owner && owner !== b.codigo) {
        // Warning (not an error): a station shared between adjacent beaches is
        // conceivable and not verifiable from here. Reported for review.
        warnings.push(`${where}: id Cruz Roja ${id} también usado por otra playa (${owner})`);
      } else if (typeof b.codigo === 'string') {
        crIdOwner.set(id, b.codigo);
      }
    }

    // Normalized aliases point to a single beach
    if (Array.isArray(b.alias) && typeof b.codigo === 'string') {
      for (const a of b.alias) {
        if (typeof a === 'string') registerAlias(aliasOwner, errors, normalizeName(a), b.codigo, where);
      }
    }
  });

  for (const [codigo, n] of ids) if (n > 1) errors.push(`codigo/id interno duplicado: ${codigo} (${n} veces)`);
  for (const [key, n] of nameMuni) if (n > 1) errors.push(`nombre+municipio duplicado: "${key}" (${n} veces)`);

  return { errors, warnings };
}

function registerAlias(
  owner: Map<string, string>, errors: string[], alias: string, codigo: string, where: string
): void {
  if (!alias) return;
  const prev = owner.get(alias);
  if (prev && prev !== codigo) {
    errors.push(`${where}: alias "${alias}" apunta a más de una playa (${prev} y ${codigo})`);
  } else {
    owner.set(alias, codigo);
  }
}

/**
 * Fields through which a catalog can reference each flag operator. It is the
 * mirror image of what `JsonBeachRepository` turns into `FlagRef`s, and the
 * one place to extend when a new operator arrives with its own catalog field.
 */
const CATALOG_FLAG_FIELDS: Record<FlagProviderId, (beach: RawCatalogBeach) => boolean> = {
  cruzroja: (beach) =>
    esReferenciaViva(beach.idCruzRoja) ||
    (beach.cruzRojaStations ?? []).some((station) => esReferenciaViva(station.id)),
};

/** The catalog convention: a missing id, or 0, means "no coverage". */
function esReferenciaViva(id: unknown): boolean {
  return typeof id === 'number' && id > 0;
}

/**
 * Does the catalog reference operators the region does not declare?
 *
 * Without this, a region that forgets `flagProviders` still parses, still
 * serves, and its beaches simply never show a flag: the router has no adapter
 * for the ref and returns null, which is indistinguishable from "no coverage".
 * Silent, and on the most safety-sensitive data in the app.
 */
export function validateCatalogFlagRefs(
  beaches: RawCatalogBeach[],
  flagProviders: FlagProviderId[],
): string[] {
  const declared = new Set(flagProviders);
  const errors: string[] = [];

  for (const [provider, referencesIt] of Object.entries(CATALOG_FLAG_FIELDS) as Array<
    [FlagProviderId, (beach: RawCatalogBeach) => boolean]
  >) {
    if (declared.has(provider)) continue;
    const afectadas = beaches.filter((beach) => referencesIt(beach));
    if (afectadas.length > 0) {
      const ejemplo = afectadas[0];
      errors.push(
        `${afectadas.length} beach(es) reference "${provider}" but the region does not declare it ` +
          `in flagProviders (e.g. ${typeof ejemplo.nombre === 'string' ? ejemplo.nombre : 'unnamed'})`,
      );
    }
  }

  return errors;
}
