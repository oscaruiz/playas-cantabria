/**
 * Prebuild: brings the selected region's data inside `src/` and `public/`.
 *
 * CRA only bundles what lives under `src/`, and copies `public/` verbatim, so
 * nothing in root `regions/` can be read at build time from the app. This
 * script is the bridge, and it runs before every start/build. Tests use the
 * committed canonical Cantabria artifacts, synchronized by `test:cantabria`.
 *
 * Region: `REACT_APP_REGION` (default `cantabria`).
 *
 * The three generated files are COMMITTED, not ignored: they are the offline
 * fallback and the PWA manifest, and the test suite reads them without running
 * a prebuild. Building another region rewrites them — `npm run sync-region`
 * with no variable puts Cantabria back.
 */

import { copyFile, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateBeachCatalog, validateRegion } from './region-validation.mjs';
import { origenPublico } from './lib/site-origin.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const regionsRoot = path.resolve(frontendRoot, '../regions');

const regionArgumentIndex = process.argv.indexOf('--region');
const regionArgument = regionArgumentIndex >= 0 ? process.argv[regionArgumentIndex + 1] : undefined;
if (regionArgumentIndex >= 0 && !regionArgument) throw new Error('--region requires an id');
const regionId = (regionArgument ?? process.env.REACT_APP_REGION ?? 'cantabria').trim();
const regionDir = path.join(regionsRoot, regionId);

if (!existsSync(regionDir)) {
  const disponibles = (await readdir(regionsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  throw new Error(
    `Unknown region "${regionId}". Available: ${disponibles.join(', ') || '(none)'}`,
  );
}

const region = JSON.parse(await readFile(path.join(regionDir, 'region.json'), 'utf8'));
const beaches = JSON.parse(await readFile(path.join(regionDir, 'beaches.json'), 'utf8'));
validateRegion(region, regionId);
validateBeachCatalog(beaches, regionId);

/**
 * Only what the interface needs. The bboxes, catalog rules and flag providers
 * are backend matters and have no business inside the bundle.
 */
const frontendConfig = {
  id: region.id,
  name: region.name,
  branding: region.branding,
  map: region.map,
};

await mkdir(path.join(frontendRoot, 'src/data'), { recursive: true });

await copyFile(
  path.join(regionDir, 'beaches.json'),
  path.join(frontendRoot, 'src/data/beaches.json'),
);

await writeFile(
  path.join(frontendRoot, 'src/data/region.json'),
  `${JSON.stringify(frontendConfig, null, 2)}\n`,
  'utf8',
);

/**
 * The region's icon, if it ships one: `regions/<id>/icon.png`, square and 512px
 * (the size the manifest declares and the one an installed app uses for its
 * splash). It is copied verbatim — this script cannot resize anything without
 * dragging an image library into the build, and every consumer downscales.
 *
 * A region without an icon keeps the generic `favicon.svg`, which is a real
 * case and not a broken one: the Cantabrian lábaro must not end up as the
 * icon of Asturias just because Cantabria was built first.
 */
const iconoRegion = path.join(regionDir, 'icon.png');
const iconoPublico = path.join(frontendRoot, 'public/icon.png');
const tieneIcono = existsSync(iconoRegion);
if (tieneIcono) {
  await copyFile(iconoRegion, iconoPublico);
} else if (existsSync(iconoPublico)) {
  // Deleted, not left behind: `public/` is copied verbatim into the build, so
  // the previous region's icon would otherwise ship inside this one — unused
  // but present, and downloadable at /icon.png.
  await rm(iconoPublico);
}

const iconosManifest = tieneIcono
  ? [
      {
        src: 'icon.png',
        type: 'image/png',
        sizes: '512x512',
        // The symbol sits inside a full-bleed background, which is exactly what
        // a maskable icon needs: Android can crop it to any shape without
        // eating into the drawing.
        purpose: 'any maskable',
      },
    ]
  : [
      {
        src: 'favicon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
    ];

// The manifest is what the browser reads to install the PWA: name, colours and
// icon have to be the region's, or every region would install as "Cantabria".
const manifest = {
  short_name: region.branding.shortName,
  name: region.branding.appName,
  description: `Estado de las playas de ${region.name}: tiempo, banderas y mareas.`,
  icons: iconosManifest,
  start_url: '.',
  scope: '.',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: region.branding.themeColor,
  background_color: region.branding.backgroundColor,
  lang: 'es',
  // The manifest points at ITSELF so `getInstalledRelatedApps()` can answer
  // "you already have this installed". Without this entry the browser always
  // says no, and whoever installed the app lost the way back to it from the
  // web: `beforeinstallprompt` is withheld once installed, so the chip simply
  // disappeared on the next visit.
  //
  // It has to be the absolute URL of the deployed manifest, so a region with
  // no hosting yet gets no entry rather than a wrong one. Note this makes the
  // check a production-only affair: from localhost the origin does not match.
  ...(origenPublico(frontendRoot, region.id)
    ? {
        related_applications: [
          { platform: 'webapp', url: `${origenPublico(frontendRoot, region.id)}/manifest.json` },
        ],
      }
    : {}),
};

await writeFile(
  path.join(frontendRoot, 'public/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

/**
 * The HTML shell carries the region's identity too, and setting it from React
 * is not enough: `<title>` is what shows while the bundle loads, and iOS reads
 * `apple-mobile-web-app-title` from the markup when the app is added to the
 * home screen — React never gets a say in that one. Both used to say "Playas
 * Cantabria" in every region's build.
 *
 * Substituted by tag and not by value, so it stays idempotent whatever region
 * was synchronized last.
 */
const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const indexPath = path.join(frontendRoot, 'public/index.html');
const shellTitle = escapeHtml(region.branding.shortName);
const shellRules = [
  /(<title>)[^<]*(<\/title>)/,
  /(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,
];

let indexHtml = await readFile(indexPath, 'utf8');
for (const pattern of shellRules) {
  if (!pattern.test(indexHtml)) {
    throw new Error(`public/index.html no longer matches ${pattern}`);
  }
  indexHtml = indexHtml.replace(pattern, (_m, open, close) => `${open}${shellTitle}${close}`);
}

/**
 * The icon links live between markers instead of being matched by tag: the
 * region decides HOW MANY there are (a PNG also declares an apple-touch-icon,
 * the SVG fallback does not), and a marked block stays idempotent whichever
 * region was synchronized last.
 */
const bloqueIcono = tieneIcono
  ? '<link rel="icon" type="image/png" href="/icon.png" />\n    <link rel="apple-touch-icon" href="/icon.png" />'
  : '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
const patronIcono = /(<!-- icono:inicio -->)[\s\S]*?(<!-- icono:fin -->)/;
if (!patronIcono.test(indexHtml)) {
  throw new Error('public/index.html no longer has the icono:inicio/icono:fin markers');
}
indexHtml = indexHtml.replace(
  patronIcono,
  (_m, abre, cierra) => `${abre}\n    ${bloqueIcono}\n    ${cierra}`,
);

await writeFile(indexPath, indexHtml, 'utf8');

process.stdout.write(`[sync-region] ${region.name} (${region.id})\n`);
