const REGION_ID = /^[a-z][a-z0-9-]*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const CAPACITOR_APP_ID = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/;
const BEACH_CODE = /^[A-Za-z0-9._~-]+$/;

function requireObject(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return {};
  }
  return value;
}

function requireString(value, path, errors, pattern) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${path} must be a non-empty string`);
  } else if (pattern && !pattern.test(value)) {
    errors.push(`${path} has an invalid format`);
  }
}

function requireNumber(value, path, errors, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    errors.push(`${path} must be a number between ${minimum} and ${maximum}`);
  }
}

/** Validate the frontend-facing subset of regions/region.schema.json. */
export function validateRegion(region, directoryId) {
  const errors = [];
  const root = requireObject(region, 'region', errors);
  requireString(root.id, 'region.id', errors, REGION_ID);
  if (root.id !== directoryId) {
    errors.push(`region.id "${root.id}" must match directory "${directoryId}"`);
  }
  requireString(root.name, 'region.name', errors);

  const branding = requireObject(root.branding, 'region.branding', errors);
  requireString(branding.appName, 'region.branding.appName', errors);
  requireString(branding.shortName, 'region.branding.shortName', errors);
  requireString(branding.themeColor, 'region.branding.themeColor', errors, COLOR);
  requireString(branding.backgroundColor, 'region.branding.backgroundColor', errors, COLOR);
  requireString(branding.capacitorAppId, 'region.branding.capacitorAppId', errors, CAPACITOR_APP_ID);

  const map = requireObject(root.map, 'region.map', errors);
  const center = requireObject(map.center, 'region.map.center', errors);
  requireNumber(center.lat, 'region.map.center.lat', errors, -90, 90);
  requireNumber(center.lon, 'region.map.center.lon', errors, -180, 180);
  requireNumber(map.zoom, 'region.map.zoom', errors, 1, 22);

  if (errors.length > 0) {
    throw new Error(`Invalid region "${directoryId}":\n- ${errors.join('\n- ')}`);
  }
}

/**
 * What the INTERFACE needs from a catalog to render without lying: an
 * identifier to link by, a name to show and usable coordinates. A beach with a
 * broken `lat`/`lon` does not fail — it silently disappears from the map — and
 * a duplicated `codigo` makes two beaches share a detail page.
 *
 * Deliberately shallow. The region's own rules (bbox, forbidden beaches,
 * duplicated operator ids) belong to the backend's `validateBeachCatalog`,
 * which already implements them and which the contribution CI will run in
 * phase 5. This one only guards the prebuild.
 */
export function validateBeachCatalog(catalog, directoryId) {
  if (!Array.isArray(catalog)) {
    throw new Error(`Invalid region "${directoryId}": beaches.json must contain an array`);
  }

  const errors = [];
  const seenCodes = new Map();

  catalog.forEach((beach, index) => {
    const where = `beaches[${index}]`;
    const entry = requireObject(beach, where, errors);
    requireString(entry.nombre, `${where}.nombre`, errors);
    requireString(entry.municipio, `${where}.municipio`, errors);
    requireString(entry.codigo, `${where}.codigo`, errors, BEACH_CODE);
    requireNumber(entry.lat, `${where}.lat`, errors, -90, 90);
    requireNumber(entry.lon, `${where}.lon`, errors, -180, 180);

    if (typeof entry.codigo === 'string' && entry.codigo.length > 0) {
      const previous = seenCodes.get(entry.codigo);
      if (previous !== undefined) {
        errors.push(`${where}.codigo "${entry.codigo}" is already used by beaches[${previous}]`);
      } else {
        seenCodes.set(entry.codigo, index);
      }
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid catalog for region "${directoryId}":\n- ${errors.join('\n- ')}`);
  }
}
