import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 180 kB: las rutas van en el bundle inicial a proposito (ver App.tsx). Bajar
// este limite dividiendo por rutas rompe la navegacion de IonRouterOutlet.
const limitBytes = 180 * 1024;
const directory = join(process.cwd(), 'build', 'static', 'js');
const mainFile = readdirSync(directory).find((name) => /^main\..+\.js$/.test(name));

if (!mainFile) {
  throw new Error('No se encontró el bundle principal. Ejecuta npm run build primero.');
}

const gzipBytes = gzipSync(readFileSync(join(directory, mainFile))).byteLength;
const gzipKb = gzipBytes / 1024;

console.log(`Bundle inicial: ${gzipKb.toFixed(2)} kB gzip (límite: 180 kB)`);
if (gzipBytes > limitBytes) {
  process.exitCode = 1;
}
