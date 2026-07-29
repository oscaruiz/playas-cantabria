/**
 * Genera data/snapshot.json: el agregado de /api/beaches/featured ya calculado.
 *
 * Pensado para ejecutarse en GitHub Actions junto al scrape de banderas. El
 * backend lo siembra al arrancar (como stale), de modo que el primer usuario tras
 * un despliegue o tras el dormido de Render free no dispara el fan-out completo
 * a los proveedores externos.
 *
 * Igual que scrape-flags.ts: si el cálculo sale vacío NO se sobrescribe el fichero
 * anterior — más vale un snapshot de hace unas horas que ninguno.
 *
 *   Uso: npm run build:snapshot   (cwd = backend/)
 */
import fs from 'fs/promises';
import path from 'path';
import { DIContainer } from '../infrastructure/di/DIContainer';
import { configureDependencies } from '../infrastructure/di/dependencies';
import { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import { httpMetrics } from '../infrastructure/http/metrics';
import { hostLimiter } from '../infrastructure/http/limiter';

const DESTINO = path.resolve(process.cwd(), 'data/snapshot.json');

async function main(): Promise<void> {
  const container = new DIContainer();
  configureDependencies(container);

  const featured = container.get<GetFeaturedBeaches>('getFeaturedBeaches');

  console.log('Calculando agregado de playas destacadas…');
  const inicio = Date.now();
  const resultado = await featured.execute(5);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  const conClima = resultado.resumenTodas.filter((r) => r.weather).length;
  const conBandera = resultado.resumenTodas.filter((r) => r.flag).length;
  const conPrevision = resultado.resumenTodas.filter((r) => r.enrichment).length;
  console.log(
    `Listo en ${segundos}s — ${resultado.resumenTodas.length} playas, ${conClima} con clima, ` +
      `${conBandera} con bandera, ${conPrevision} con previsión AEMET, ` +
      `${resultado.mejores.length} destacadas.`,
  );

  // Desglose por proveedor: sin esto, un "0 con previsión AEMET" no distingue
  // entre clave mal puesta (4xx), límite de peticiones (429), bloqueo de la IP
  // del runner (5xx/red) y enfriamiento por un 429 previo (0 peticiones).
  console.log('\nPeticiones salientes por proveedor:');
  for (const [host, c] of Object.entries(httpMetrics.snapshot().desdeArranque)) {
    console.log(
      `  ${host.padEnd(26)} total=${c.total} ok=${c.ok} 4xx=${c.clientError} ` +
        `429=${c.rateLimited} 5xx=${c.serverError} red=${c.networkError}`,
    );
  }
  const enfriados = Object.entries(hostLimiter.snapshot()).filter(
    ([, v]) => v.enfriamientoMs > 0,
  );
  if (enfriados.length > 0) {
    console.log(
      'Hosts en enfriamiento por 429:',
      enfriados.map(([h, v]) => `${h} (${Math.ceil(v.enfriamientoMs / 1000)}s)`).join(', '),
    );
  }

  // Sin clima el snapshot no aporta nada (típicamente: faltan las claves de API en
  // el entorno de CI). Se prefiere conservar el anterior antes que degradarlo.
  if (conClima === 0) {
    console.error('Ninguna playa trajo clima: NO se sobrescribe el snapshot anterior.');
    process.exitCode = 1;
    return;
  }

  await fs.writeFile(
    DESTINO,
    JSON.stringify({ generatedAt: new Date().toISOString(), featured: resultado }, null, 0),
    'utf-8',
  );
  console.log(`Escrito ${DESTINO}`);
}

main().catch((e) => {
  console.error('build-snapshot falló:', e);
  process.exitCode = 1;
});
