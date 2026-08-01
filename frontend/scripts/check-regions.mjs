/**
 * Verify that every contributed region is buildable, and that its hosting is
 * configured.
 *
 * The two are checked apart on purpose. Region DATA is something a contributor
 * owns and can fix in their own PR, so an invalid region always fails. The
 * hosting site, on the other hand, only the maintainer can create: failing a
 * data-only PR over a Firebase target that is not the contributor's to add
 * would turn "a region is a directory of data" into a lie. It is reported as a
 * warning here and, with `--require-hosting`, an error where it really blocks
 * — the deploy.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateBeachCatalog, validateRegion } from './region-validation.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionsRoot = path.resolve(frontendRoot, '../regions');
const entries = await readdir(regionsRoot, { withFileTypes: true });
const regionIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const firebase = JSON.parse(await readFile(path.join(frontendRoot, 'firebase.json'), 'utf8'));
const firebaserc = JSON.parse(await readFile(path.join(frontendRoot, '.firebaserc'), 'utf8'));
const projectId = firebaserc.projects?.default;
const mappedTargets = firebaserc.targets?.[projectId]?.hosting ?? {};
const configuredTargets = new Set((firebase.hosting ?? []).map((entry) => entry.target));
const requireHosting = process.argv.includes('--require-hosting');
/**
 * `--region <id>`: whose hosting has to exist. Data validation always covers
 * every region (uniqueness is cross-region and cheap), but the deploy only
 * needs the site of what it is deploying. Without this, asking to deploy
 * Cantabria failed because Asturias had no Firebase target yet — a region that
 * was not even part of the request blocking one that was ready.
 */
const regionArgIndex = process.argv.indexOf('--region');
const onlyRegion = regionArgIndex >= 0 ? process.argv[regionArgIndex + 1] : undefined;
if (onlyRegion !== undefined && !onlyRegion) {
  throw new Error('--region needs a region id');
}
const errors = [];
const hostingIssues = [];
const appIds = new Map();
const hostingSites = new Map();

for (const regionId of regionIds) {
  const regionDir = path.join(regionsRoot, regionId);
  try {
    const region = JSON.parse(await readFile(path.join(regionDir, 'region.json'), 'utf8'));
    const beaches = JSON.parse(await readFile(path.join(regionDir, 'beaches.json'), 'utf8'));
    validateRegion(region, regionId);
    validateBeachCatalog(beaches, regionId);
    const previousRegion = appIds.get(region.branding.capacitorAppId);
    if (previousRegion) {
      errors.push(`regions "${previousRegion}" and "${regionId}" share capacitorAppId "${region.branding.capacitorAppId}"`);
    } else {
      appIds.set(region.branding.capacitorAppId, regionId);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (!configuredTargets.has(regionId)) {
    hostingIssues.push({ regionId, message: `firebase.json is missing target "${regionId}"` });
  }
  if (!Array.isArray(mappedTargets[regionId]) || mappedTargets[regionId].length === 0) {
    hostingIssues.push({ regionId, message: `.firebaserc is missing hosting target "${regionId}"` });
  }
}

for (const [target, sites] of Object.entries(mappedTargets)) {
  if (!Array.isArray(sites)) continue;
  for (const site of sites) {
    const previousTarget = hostingSites.get(site);
    if (previousTarget && previousTarget !== target) {
      errors.push(`Firebase targets "${previousTarget}" and "${target}" share site "${site}"`);
    } else {
      hostingSites.set(site, target);
    }
  }
}

// A target with no region is always an error: it deploys nothing, and only the
// maintainer could have added it in the first place.
for (const target of configuredTargets) {
  if (!regionIds.includes(target)) errors.push(`firebase.json target "${target}" has no region directory`);
}

if (onlyRegion && !regionIds.includes(onlyRegion)) {
  errors.push(`--region "${onlyRegion}" has no region directory`);
}

const required = onlyRegion
  ? hostingIssues.filter((issue) => issue.regionId === onlyRegion)
  : hostingIssues;
if (requireHosting) errors.push(...required.map((issue) => issue.message));

if (errors.length > 0) throw new Error(`Region configuration errors:\n- ${errors.join('\n- ')}`);

for (const issue of hostingIssues) {
  process.stdout.write(`[check-regions] WARNING: ${issue.message}\n`);
}
process.stdout.write(`[check-regions] ${regionIds.join(', ')}\n`);
