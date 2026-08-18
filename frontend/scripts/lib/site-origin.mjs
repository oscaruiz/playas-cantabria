/**
 * Public origin of the region being built, shared by generate-sitemap.mjs
 * and prerender.mjs so both derive it identically:
 * REACT_APP_SITE_ORIGIN (process.env) → REACT_APP_SITE_ORIGIN in
 * frontend/.env.production (CRA loads that file for the bundle, but these
 * scripts run outside CRA, so it is read here) → the region's Firebase
 * Hosting site in .firebaserc (https://<site>.web.app) → null (contributed
 * region with no hosting yet).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function normalizar(valor) {
  const limpio = valor?.trim().replace(/\/+$/, '');
  return limpio || null;
}

/** REACT_APP_SITE_ORIGIN from frontend/.env.production, without dotenv. */
function origenDeEnvProduction(frontendDir) {
  const ruta = join(frontendDir, '.env.production');
  if (!existsSync(ruta)) return null;
  try {
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = /^\s*REACT_APP_SITE_ORIGIN\s*=\s*(.*)$/.exec(linea);
      if (m) return normalizar(m[1].replace(/^(['"])(.*)\1$/, '$2'));
    }
  } catch {
    /* unreadable: fall through to .firebaserc */
  }
  return null;
}

export function origenPublico(frontendDir, regionId) {
  // A DEFINED env var wins even when empty: `REACT_APP_SITE_ORIGIN=` is how a
  // build for another region silences .env.production, whose origin belongs to
  // the region deployed from this checkout.
  if (process.env.REACT_APP_SITE_ORIGIN != null) {
    const porEnv = normalizar(process.env.REACT_APP_SITE_ORIGIN);
    if (porEnv) return porEnv;
  } else {
    const porFichero = origenDeEnvProduction(frontendDir);
    if (porFichero) return porFichero;
  }

  const rutaRc = join(frontendDir, '.firebaserc');
  if (!existsSync(rutaRc)) return null;
  try {
    const rc = JSON.parse(readFileSync(rutaRc, 'utf8'));
    for (const proyecto of Object.values(rc.targets ?? {})) {
      const sitios = proyecto.hosting?.[regionId];
      if (Array.isArray(sitios) && sitios.length > 0) return `https://${sitios[0]}.web.app`;
    }
  } catch {
    return null;
  }
  return null;
}
