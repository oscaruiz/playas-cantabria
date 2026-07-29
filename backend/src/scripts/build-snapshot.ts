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
  console.log(
    `Listo en ${segundos}s — ${resultado.resumenTodas.length} playas, ${conClima} con clima, ` +
      `${conBandera} con bandera, ${resultado.mejores.length} destacadas.`,
  );

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
