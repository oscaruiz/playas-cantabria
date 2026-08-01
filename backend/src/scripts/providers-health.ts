/**
 * Fails when a provider is answering nothing but errors in production.
 *
 * Born from a real case: Open-Meteo returned 429 to **every** request from
 * Render for hours. Nothing broke — the rain nowcast simply fell back to two
 * sources and `lluvia.prevista` stopped existing, so the app quietly stopped
 * warning about coming rain. Every layer degraded exactly as designed, and the
 * result was a feature dead in production with nobody the wiser.
 *
 * The 429 itself is not something the code can fix (it is the shared egress IP
 * of the free tier, not our quota: 17 requests in three hours exhaust nothing).
 * What the code CAN do is stop the failure from being silent.
 *
 * Two sources, and only one of them is an observation. The metrics say what
 * production's own traffic did; the ACTIVE PROBE (`/api/_diag/providers`,
 * needs DIAG_PROBE_TOKEN) makes it call every provider now. Without the probe
 * the check can be vacuous — an empty window has no failures in it — so with
 * no token and no traffic it fails instead of approving.
 *
 *   npm run providers:health                  → checks production
 *   npm run providers:health -- --url http://localhost:4000
 *   DIAG_PROBE_TOKEN=... npm run providers:health   → with the active probe
 */

/** Below this, "0 ok" is just a quiet host, not an outage. */
const MIN_PETICIONES = 5;

/**
 * Providers that must be reachable from production. Reading the metrics alone
 * could never notice a MISSING one: an absent host contributes no failure, so
 * a window where nobody called Open-Meteo — a fresh process, a cache that
 * served everything, a feature already dead — read as perfect health.
 */
const ESPERADOS = ['api.openweathermap.org', 'api.open-meteo.com', 'opendata.aemet.es'];

interface ProbeResult {
  host: string;
  estado: 'ok' | 'fallo' | 'sin-clave';
  status: number | null;
  ms: number;
  detalle: string | null;
}

interface HostStats {
  total: number;
  ok: number;
  rateLimited: number;
  clientError: number;
  serverError: number;
  networkError: number;
}

const BASE_POR_DEFECTO = 'https://playas-cantabria.onrender.com';

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Asks production to call every provider right now. This is the part that
 * OBSERVES: without it the check can only describe traffic that may not have
 * happened, and approving on no evidence is what let the Open-Meteo outage run
 * for hours.
 */
async function probar(base: string, token: string): Promise<string[]> {
  const respuesta = await fetch(`${base}/api/_diag/providers`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) {
    throw new Error(
      `No se pudo sondear ${base}/api/_diag/providers: HTTP ${respuesta.status}` +
        (respuesta.status === 404 ? ' (¿DIAG_PROBE_TOKEN sin configurar en el servidor?)' : ''),
    );
  }

  const { proveedores } = (await respuesta.json()) as { proveedores?: ProbeResult[] };
  if (!proveedores) throw new Error('La respuesta de /api/_diag/providers no trae proveedores');

  const fallos: string[] = [];
  const sondeados = new Set(proveedores.map((p) => p.host));

  for (const p of proveedores) {
    if (p.estado === 'ok') {
      process.stdout.write(`[providers-health] sonda ${p.host}: ${p.status} en ${p.ms} ms\n`);
    } else if (p.estado === 'sin-clave') {
      // The key belongs to the deployment's configuration, not to the health
      // of the provider: reported loudly, but it does not turn the check red.
      process.stdout.write(`[providers-health] sonda ${p.host}: sin clave configurada, no se sondea\n`);
    } else {
      fallos.push(`${p.host}: la sonda falló (${p.detalle ?? 'sin detalle'}${p.status ? `, HTTP ${p.status}` : ''})`);
    }
  }

  for (const host of ESPERADOS) {
    if (!sondeados.has(host)) fallos.push(`${host}: el servidor no lo sondea (proveedor ausente)`);
  }

  return fallos;
}

async function main(): Promise<void> {
  const base = (argOf('url') ?? BASE_POR_DEFECTO).replace(/\/+$/, '');
  const token = argOf('token') ?? process.env.DIAG_PROBE_TOKEN?.trim();
  const respuesta = await fetch(`${base}/api/_diag/metrics`);
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${base}/api/_diag/metrics: HTTP ${respuesta.status}`);
  }

  const cuerpo = (await respuesta.json()) as {
    peticionesSalientes?: Record<string, Record<string, HostStats>>;
  };
  // The last day, not since startup: on Render free the process restarts often
  // and a fresh one would look healthy just for having done nothing yet.
  const ventana = cuerpo.peticionesSalientes?.ultimoDia ?? cuerpo.peticionesSalientes?.desdeArranque;
  if (!ventana) throw new Error('La respuesta de /api/_diag/metrics no trae peticionesSalientes');

  const caidos: string[] = [];
  let observados = 0;
  for (const [host, s] of Object.entries(ventana)) {
    if (ESPERADOS.includes(host) && s.total > 0) observados++;
    if (s.total < MIN_PETICIONES) {
      process.stdout.write(`[providers-health] ${host}: ${s.total} peticiones, muestra insuficiente\n`);
      continue;
    }
    if (s.ok === 0) {
      caidos.push(
        `${host}: ${s.total} peticiones y NINGUNA correcta ` +
          `(429=${s.rateLimited}, 4xx=${s.clientError}, 5xx=${s.serverError}, red=${s.networkError})`,
      );
    } else {
      const pct = Math.round((s.ok / s.total) * 100);
      process.stdout.write(`[providers-health] ${host}: ${pct}% correctas (${s.ok}/${s.total})\n`);
    }
  }

  if (token) {
    caidos.push(...(await probar(base, token)));
  } else if (observados === 0) {
    // Without a probe AND without traffic there is nothing to conclude. Saying
    // "all good" here is the bug: the check would approve a production where
    // every provider is down, precisely because it is down.
    caidos.push(
      'no se observó ningún proveedor en la ventana y no hay DIAG_PROBE_TOKEN para sondear: ' +
        'la comprobación no puede afirmar nada',
    );
  } else {
    process.stdout.write('[providers-health] sin DIAG_PROBE_TOKEN: solo métricas, sin sonda activa\n');
  }

  if (caidos.length > 0) {
    for (const caido of caidos) console.error(`[providers-health] ${caido}`);
    throw new Error(`${caidos.length} problema(s) de proveedor`);
  }
}

main().catch((error) => {
  console.error(`[providers-health] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
