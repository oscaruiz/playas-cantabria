import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Read from the generated region file (`npm run sync-region`) instead of
 * imported: the Capacitor CLI evaluates this outside the CRA bundle. Each
 * region needs its own `appId` to exist as a separate app in the Store.
 */
const region = JSON.parse(
  readFileSync(path.resolve(__dirname, 'src/data/region.json'), 'utf8'),
) as { branding: { appName: string; capacitorAppId: string } };

const config: CapacitorConfig = {
  appId: region.branding.capacitorAppId,
  appName: region.branding.appName,
  webDir: 'build'
};

export default config;
