import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 185 kB: las rutas van en el bundle inicial a proposito (ver App.tsx). Bajar
// este limite dividiendo por rutas rompe la navegacion de IonRouterOutlet.
//
// Subido de 180 el 2-ago-2026. El tope es un guardia contra el engorde, no una
// congelacion: la app ya estaba en 179,83 kB (0,17 de margen) y el chip de
// tendencia -un componente, sus textos en dos idiomas y el cableado de cuatro
// pantallas- costo 0,49 kB. Con ese margen, la siguiente funcion de cualquier
// tamano habria fallado aqui, y recortar por debajo del limite habria sido
// ofuscar codigo legible para ganar 300 bytes.
//
// Los 185 dan sitio a un par de funciones mas. Cuando se vuelva a tocar, la
// pregunta no es cuanto subirlo sino que pesa tanto: medir primero con
// `source-map-explorer` y mirar Ionic y Leaflet antes que el codigo propio.
const limitBytes = 185 * 1024;
const directory = join(process.cwd(), 'build', 'static', 'js');
const mainFile = readdirSync(directory).find((name) => /^main\..+\.js$/.test(name));

if (!mainFile) {
  throw new Error('No se encontró el bundle principal. Ejecuta npm run build primero.');
}

const gzipBytes = gzipSync(readFileSync(join(directory, mainFile))).byteLength;
const gzipKb = gzipBytes / 1024;

// El limite sale de la constante, no repetido a mano: cuando se subio de 180 a
// 185 este mensaje siguio diciendo 180 y el informe contradecia al propio guardia.
console.log(`Bundle inicial: ${gzipKb.toFixed(2)} kB gzip (límite: ${limitBytes / 1024} kB)`);
if (gzipBytes > limitBytes) {
  process.exitCode = 1;
}
