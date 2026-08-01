/**
 * Scaffolds a new region and prints the checklist of what only a human can do.
 *
 *   npm run region:new -- --id asturias --name Asturias
 *
 * Generates a region.json that is VALID but deliberately empty of beaches:
 * the bottleneck of adding a region is never the code, it is compiling the
 * catalogue, and a skeleton full of invented data would be worse than none.
 */
import fs from 'fs';
import path from 'path';

const regionsRoot = path.resolve(__dirname, '../../../regions');

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const id = argOf('id');
const name = argOf('name') ?? (id ? id[0].toUpperCase() + id.slice(1) : undefined);

if (!id || !name) {
  throw new Error('Usage: npm run region:new -- --id <id> [--name <Name>]');
}
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  throw new Error(`Invalid id "${id}": lowercase letters, digits and dashes, starting with a letter`);
}

const regionDir = path.join(regionsRoot, id);
if (fs.existsSync(regionDir)) {
  throw new Error(`regions/${id} already exists`);
}

const region = {
  $schema: '../region.schema.json',
  id,
  name,
  // Wide on purpose: it trims AEMET's Spain-wide observation list down to the
  // stations that can serve this region. Too tight and beaches lose their
  // observation; a few tens of km of margin cost nothing.
  observationBbox: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
  catalogRules: {
    // Tight: this one is the integrity check on the catalogue's coordinates.
    bbox: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
    regionName: name,
    forbiddenBeaches: [],
  },
  // Empty is a supported configuration, not a degraded one: the app then says
  // "no lifeguard service here" instead of inventing one.
  flagProviders: [],
  branding: {
    appName: `Playas de ${name}`,
    shortName: `Playas ${name}`,
    themeColor: '#0a7ea4',
    backgroundColor: '#faf6f1',
    capacitorAppId: `com.example.${id}`,
  },
  map: { center: { lat: 0, lon: 0 }, zoom: 9 },
};

fs.mkdirSync(regionDir, { recursive: true });
fs.writeFileSync(path.join(regionDir, 'region.json'), `${JSON.stringify(region, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(regionDir, 'beaches.json'), '[]\n', 'utf8');

process.stdout.write(`
Created regions/${id}/ with region.json and an empty beaches.json.

What is left, and only a person can do it:

  1. Bounding boxes. \`catalogRules.bbox\` tight around the real coast;
     \`observationBbox\` with tens of km of margin. Both are still 0/0/0/0,
     so validation will fail until you fill them in.
  2. Map centre and zoom.
  3. The catalogue: regions/${id}/beaches.json. Per beach, nombre, municipio,
     codigo (AEMET beach code), lat and lon. Without an AEMET sheet, use a
     synthetic codigo and mark it \`"sinAemet": true\`.
  4. Flag operator, if there is one: declare it in \`flagProviders\` and add
     each beach's reference. If you declare none, the app says so honestly.
  5. \`branding.capacitorAppId\`: com.example.${id} is a placeholder and cannot
     go to the Play Store.

Then, from backend/:

  npm run validate:regions   # schema, catalogue, coordinates, flag operators
  npm run quota:budget       # does it fit on the free tiers alongside the rest?

And from frontend/:

  npm run check-regions      # data + Firebase hosting configuration

The full guide is in docs/ADDING-A-REGION.md.
`);
