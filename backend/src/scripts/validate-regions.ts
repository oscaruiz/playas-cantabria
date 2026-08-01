import fs from 'fs';
import path from 'path';
import { RegionRegistry } from '../regions/RegionRegistry';
import { readFlagsFile } from '../regions/flagsFileSchema';

const regionsRoot = path.resolve(__dirname, '../../../regions');
const expected = fs
  .readdirSync(regionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(regionsRoot, entry.name, 'region.json')))
  .map((entry) => entry.name)
  .sort();
const errors: string[] = [];
const registry = new RegionRegistry(regionsRoot, { error: (message) => errors.push(message) }).load();
const loaded = registry.all().map((region) => region.id).sort();

/**
 * The registry only records the PATH of flags.json, and the provider swallows
 * any read or parse error and serves an empty map. A corrupt file therefore
 * ships a region whose flags are all missing, silently — and flags are the most
 * safety-sensitive data served. If the file is there it has to parse here; if
 * it is not, that is legitimate (a new region has none until the cron runs) and
 * the live scraping covers it.
 *
 * "Parses" is not enough: the whole content is checked against the shared
 * schema (`readFlagsFile`). Accepting any object let through impossible data —
 * a colour that is not a colour, a station id that is not a number and, worst
 * of all, a `generatedAt` in the future, which makes the capture immortal
 * because freshness is `now - generatedAt`.
 */
for (const region of registry.all()) {
  if (!fs.existsSync(region.flagsPath)) {
    if (region.flagProviders.length > 0) {
      console.warn(`[validate-regions] ${region.id}: no flags.json yet; relying on live scraping`);
    }
    continue;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(region.flagsPath, 'utf-8')) as unknown;
    const { errors: flagErrors } = readFlagsFile(raw);
    for (const error of flagErrors) errors.push(`${region.id}: flags.json ${error}`);
  } catch (error) {
    errors.push(`${region.id}: flags.json is not valid JSON (${(error as Error).message})`);
  }
}

if (errors.length > 0 || expected.join('\0') !== loaded.join('\0')) {
  for (const error of errors) console.error(error);
  throw new Error(`Expected regions [${expected.join(', ')}], loaded [${loaded.join(', ')}]`);
}

console.log(`[validate-regions] ${loaded.join(', ')}`);
