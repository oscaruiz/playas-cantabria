/**
 * Generates data/snapshot.json: the /api/beaches/featured aggregate, precomputed.
 *
 * Meant to run in GitHub Actions alongside the flag scrape. The backend seeds
 * it on startup (as stale), so that the first user after a deployment or after
 * the Render free sleep does not trigger the full fan-out to the external
 * providers.
 *
 * Same as scrape-flags.ts: if the computation comes out empty the previous file
 * is NOT overwritten — a snapshot from a few hours ago beats no snapshot.
 *
 *   Usage: npm run build:snapshot   (cwd = backend/)
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

  // Breakdown per provider: without this, a "0 with AEMET forecast" does not
  // distinguish between a wrong key (4xx), rate limiting (429), the runner's IP
  // being blocked (5xx/network) and cooldown from a previous 429 (0 requests).
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

  // Without weather the snapshot adds nothing (typically: the API keys are
  // missing in the CI environment). Keeping the previous one is preferred over
  // degrading it.
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
