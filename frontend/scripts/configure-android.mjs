/** Apply the synchronized region identity to the ignored native Android project. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { escapeAndroidString } from './android-strings.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = JSON.parse(await readFile(path.join(frontendRoot, 'src/data/region.json'), 'utf8'));
const appId = region.branding.capacitorAppId;
const appName = region.branding.appName;
const androidRoot = path.join(frontendRoot, 'android/app');
const gradlePath = path.join(androidRoot, 'build.gradle');
const stringsPath = path.join(androidRoot, 'src/main/res/values/strings.xml');

let gradle = await readFile(gradlePath, 'utf8');
if (!/^\s*applicationId\s+"[^"]+"/m.test(gradle)) {
  throw new Error('Cannot find applicationId in android/app/build.gradle');
}
gradle = gradle.replace(/^(\s*applicationId\s+)"[^"]+"/m, (_m, prefix) => `${prefix}"${appId}"`);

let strings = await readFile(stringsPath, 'utf8');
const values = { app_name: appName, title_activity_main: appName, package_name: appId, custom_url_scheme: appId };
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`(<string name="${name}">)[^<]*(</string>)`);
  if (!pattern.test(strings)) throw new Error(`Cannot find Android string ${name}`);
  // Replacer function, not a template: a `$` in the region name would
  // otherwise be read as a replacement pattern ($&, $1...) and mangle the tag.
  strings = strings.replace(pattern, (_m, open, close) => `${open}${escapeAndroidString(value)}${close}`);
}
// Validate every transformation before touching either native file. Writing
// both only starts after the complete next state is known to be coherent.
await Promise.all([
  writeFile(gradlePath, gradle, 'utf8'),
  writeFile(stringsPath, strings, 'utf8'),
]);
process.stdout.write(`[configure-android] ${appName} (${appId})\n`);
