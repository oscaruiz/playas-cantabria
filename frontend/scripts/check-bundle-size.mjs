import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const limitBytes = 145 * 1024;
const directory = join(process.cwd(), 'build', 'static', 'js');
const mainFile = readdirSync(directory).find((name) => /^main\..+\.js$/.test(name));

if (!mainFile) {
  throw new Error('No se encontró el bundle principal. Ejecuta npm run build primero.');
}

const gzipBytes = gzipSync(readFileSync(join(directory, mainFile))).byteLength;
const gzipKb = gzipBytes / 1024;

console.log(`Bundle inicial: ${gzipKb.toFixed(2)} kB gzip (límite: 145 kB)`);
if (gzipBytes > limitBytes) {
  process.exitCode = 1;
}
