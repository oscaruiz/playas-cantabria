/**
 * Validación automatizada del catálogo de playas (backend/data/beaches.json).
 *
 * Función PURA: recibe el array crudo (claves en español) y devuelve una lista de
 * errores (vacía = catálogo válido). Se ejecuta en un test y puede reutilizarse en
 * un script de CI. No hace red: no comprueba la "vigencia" de un código AEMET en
 * aemet.es (eso se verifica en el proceso de alta), solo la integridad estructural.
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

// Rango geográfico razonable de Cantabria (con un pequeño margen).
export const CANTABRIA_BBOX = { latMin: 43.2, latMax: 43.65, lonMin: -4.9, lonMax: -3.0 };

const KNOWN_ATTRS = new Set([
  'accesoBanista', 'accesible', 'mascotas', 'duchas', 'aseos',
  'parking', 'chiringuito', 'socorrismo', 'nudista', 'surf',
]);

/** minúsculas, sin tildes, sin espacios repetidos, trim. NO quita artículos. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CatalogValidationResult {
  /** Problemas de integridad que DEBEN estar vacíos (rompen el test). */
  errors: string[];
  /** Señales sospechosas a revisar (no rompen el build; se reportan). */
  warnings: string[];
}

export function validateBeachCatalog(beaches: RawCatalogBeach[]): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, number>();          // codigo -> count
  const nameMuni = new Map<string, number>();      // normalized "nombre|municipio" -> count
  const crIdOwner = new Map<number, string>();     // cruz roja id -> beach codigo
  const aliasOwner = new Map<string, string>();    // normalized alias -> beach codigo

  beaches.forEach((b, i) => {
    const where = typeof b.nombre === 'string' ? `"${b.nombre}"` : `#${i}`;

    // Campos obligatorios
    if (typeof b.nombre !== 'string' || !b.nombre.trim()) errors.push(`${where}: nombre inválido`);
    if (typeof b.municipio !== 'string' || !b.municipio.trim()) errors.push(`${where}: municipio inválido`);
    if (typeof b.codigo !== 'string' || !/^\d{7}$/.test(b.codigo)) {
      errors.push(`${where}: codigo (id interno) inválido (se espera 7 dígitos)`);
    }

    // Id interno único
    if (typeof b.codigo === 'string') ids.set(b.codigo, (ids.get(b.codigo) ?? 0) + 1);

    // Nombre+municipio normalizado único
    if (typeof b.nombre === 'string' && typeof b.municipio === 'string') {
      const key = `${normalizeName(b.nombre)}|${normalizeName(b.municipio)}`;
      nameMuni.set(key, (nameMuni.get(key) ?? 0) + 1);
    }

    // "La Concha de Santander" no debe existir
    if (
      typeof b.nombre === 'string' && typeof b.municipio === 'string' &&
      normalizeName(b.municipio) === 'santander' &&
      /^(la )?concha( de santander)?$/.test(normalizeName(b.nombre))
    ) {
      errors.push(`${where}: "La Concha de Santander" no debe existir en el catálogo`);
    }

    // Coordenadas dentro de rango
    const lat = b.lat, lon = b.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
      errors.push(`${where}: coordenadas ausentes o no numéricas`);
    } else if (
      lat < CANTABRIA_BBOX.latMin || lat > CANTABRIA_BBOX.latMax ||
      lon < CANTABRIA_BBOX.lonMin || lon > CANTABRIA_BBOX.lonMax
    ) {
      errors.push(`${where}: coordenadas fuera del rango de Cantabria (${lat}, ${lon})`);
    }

    // Longitud/anchura no negativas
    for (const [k, v] of [['longitud', b.longitud], ['anchura', b.anchura]] as const) {
      if (v != null && (typeof v !== 'number' || v < 0)) errors.push(`${where}: ${k} negativa o no numérica`);
    }

    // Atributos: solo claves conocidas y booleanas (nunca null → evita que "desconocido" se vuelva false)
    if (b.atributos && typeof b.atributos === 'object') {
      for (const [k, v] of Object.entries(b.atributos)) {
        if (!KNOWN_ATTRS.has(k)) errors.push(`${where}: atributo desconocido "${k}"`);
        if (v !== true && v !== false && v !== undefined) {
          errors.push(`${where}: atributo "${k}" debe ser boolean u omitido (no ${JSON.stringify(v)})`);
        }
      }
    }

    // Ids de Cruz Roja (idCruzRoja + puestos) no se repiten entre playas físicas distintas
    const crIds: number[] = [];
    if (typeof b.idCruzRoja === 'number' && b.idCruzRoja > 0) crIds.push(b.idCruzRoja);
    if (Array.isArray(b.cruzRojaStations)) {
      for (const s of b.cruzRojaStations) {
        if (typeof s?.nombreFuente !== 'string' || !s.nombreFuente.trim()) {
          errors.push(`${where}: puesto Cruz Roja sin nombreFuente`);
        }
        if (typeof s?.id === 'number' && s.id > 0) crIds.push(s.id);
        // El nombre del puesto es también un alias operativo → debe resolver a esta playa
        if (typeof s?.nombreFuente === 'string' && typeof b.codigo === 'string') {
          registerAlias(aliasOwner, errors, normalizeName(s.nombreFuente), b.codigo, where);
        }
      }
    }
    for (const id of crIds) {
      const owner = crIdOwner.get(id);
      if (owner && owner !== b.codigo) {
        // Warning (no error): un puesto compartido entre playas contiguas es
        // concebible y no verificable desde aquí. Se reporta para revisión.
        warnings.push(`${where}: id Cruz Roja ${id} también usado por otra playa (${owner})`);
      } else if (typeof b.codigo === 'string') {
        crIdOwner.set(id, b.codigo);
      }
    }

    // Alias normalizados apuntan a una única playa
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
