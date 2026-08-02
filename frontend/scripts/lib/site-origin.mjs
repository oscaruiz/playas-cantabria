/**
 * Public origin of the region being built, shared by generate-sitemap.mjs
 * and prerender.mjs so both derive it identically:
 * REACT_APP_SITE_ORIGIN → the region's Firebase Hosting site in .firebaserc
 * (https://<site>.web.app) → null (contributed region with no hosting yet).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function origenPublico(frontendDir, regionId) {
  const porEnv = process.env.REACT_APP_SITE_ORIGIN?.trim().replace(/\/+$/, '');
  if (porEnv) return porEnv;

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
