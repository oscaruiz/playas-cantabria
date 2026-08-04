/**
 * Scrapes the Cruz Roja flags and writes the active region's flags.json.
 *
 * Meant to run:
 *  - in GitHub Actions (cron) → commits the flags.json that the backend serves, or
 *  - locally (Spanish residential IP) as a fallback if Azure/GitHub is blocked.
 *
 * cruzroja.es (WAF F5) returns 403 to datacenter IPs. This script prints the
 * HTTP status of each beach to make it obvious whether the environment is blocked.
 *
 *   Usage: npm run scrape:flags   (cwd = backend/)
 */
import fs from 'fs/promises';
import axios from 'axios';
import { load } from 'cheerio';
import { resolveScriptRegion } from './scriptRegion';

const region = resolveScriptRegion();

const BASE = 'https://www.cruzroja.es/appjv/consPlayas';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Content-Type': 'application/x-www-form-urlencoded',
  Origin: 'https://www.cruzroja.es',
  Referer: `${BASE}/listaPlayas.do`
};

type StoredFlag = {
  color: string | null;
  message: string | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  schedule: string | null;
};

function detectColor(alt: string): string | null {
  const s = alt.toLowerCase();
  if (s.includes('roja')) return 'red';
  if (s.includes('amarilla')) return 'yellow';
  if (s.includes('verde')) return 'green';
  if (s.includes('negra')) return 'black';
  return null;
}

/** Pause between fiches: 69 POSTs back to back is what the WAF reads as a bot. */
const PAUSA_MS = 400;
/** Attempts per fiche. The block is intermittent, so a second try often lands. */
const INTENTOS = 3;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(id: number): Promise<{ status: number | null; flag: StoredFlag | null; err?: string }> {
  let ultimo: { status: number | null; flag: StoredFlag | null; err?: string } = {
    status: null,
    flag: null,
    err: 'sin intentos',
  };

  for (let intento = 1; intento <= INTENTOS; intento++) {
    ultimo = await fetchOneOnce(id);
    // A fiche that answered is done — including a 200 with no flag, which is
    // an answer ("No hay informacion"), not a failure to reach the site.
    if (ultimo.status === 200) return ultimo;
    // Only a block or a network error is worth insisting on. Backoff with
    // jitter so the retries of 69 fiches do not line up into a new burst.
    if (ultimo.status !== 403 && !ultimo.err) return ultimo;
    if (intento < INTENTOS) await dormir(1000 * 2 ** (intento - 1) + Math.random() * 500);
  }

  return ultimo;
}

async function fetchOneOnce(id: number): Promise<{ status: number | null; flag: StoredFlag | null; err?: string }> {
  try {
    const resp = await axios.post(
      `${BASE}/fichaPlaya.do`,
      new URLSearchParams({ id: String(id), action: '', aplicacion: 'consultaPlayas' }).toString(),
      { headers: HEADERS, timeout: 20000, validateStatus: () => true }
    );
    if (resp.status !== 200) return { status: resp.status, flag: null };

    const $ = load(resp.data as string);
    const alt = $('#listaFicha img[alt]').attr('alt')?.trim();
    if (!alt) return { status: 200, flag: null };

    return {
      status: 200,
      flag: {
        color: detectColor(alt),
        message: alt,
        coverageFrom: $('li:contains("Cobertura desde")').next().text().trim() || null,
        coverageTo: $('li:contains("Hasta")').next().text().trim() || null,
        schedule: $('li:contains("Horario")').next().text().trim() || null
      }
    };
  } catch (e: any) {
    return { status: null, flag: null, err: e?.code || e?.message || String(e) };
  }
}

async function main() {
  const beaches = JSON.parse(await fs.readFile(region.catalogPath, 'utf-8')) as Array<{
    nombre: string;
    idCruzRoja?: number;
    cruzRojaStations?: Array<{ id?: number; nombreFuente: string }>;
  }>;

  // Collects ids from the single beach (`idCruzRoja`) AND from every station
  // (`cruzRojaStations`) of the multi-station beaches.
  const ids = Array.from(
    new Set(
      beaches
        .flatMap((b) => [b.idCruzRoja, ...(b.cruzRojaStations ?? []).map((s) => s.id)])
        .filter((x): x is number => typeof x === 'number' && x > 0)
    )
  );

  const flags: Record<string, StoredFlag> = {};
  let ok = 0;
  let blocked = 0;
  const statusCount: Record<string, number> = {};

  let primera = true;
  for (const id of ids) {
    if (!primera) await dormir(PAUSA_MS);
    primera = false;
    const r = await fetchOne(id);
    const key = r.err ? `ERR:${r.err}` : String(r.status);
    statusCount[key] = (statusCount[key] ?? 0) + 1;
    if (r.flag) {
      flags[String(id)] = r.flag;
      ok++;
      console.log(`  id ${id}: ${r.status} -> ${r.flag.color ?? '??'}`);
    } else {
      if (r.status === 403) blocked++;
      console.log(`  id ${id}: ${r.status ?? r.err} -> (sin bandera)`);
    }
  }

  const colored = Object.values(flags).filter((f) => f.color).length;
  console.log(
    `\nResumen: ${ok}/${ids.length} con ficha | ${colored} con bandera izada | estados:`,
    statusCount
  );

  if (ok === 0) {
    console.error(
      `\n❌ 0 fichas obtenidas (${blocked} con 403). El entorno parece BLOQUEADO por el WAF.\n` +
        `   No se sobrescribe flags.json. Prueba a ejecutar este script desde una IP residencial española.`
    );
    process.exit(1);
  }

  // If no beach has a color (all "No hay información"), the scrape ran BEFORE
  // the hoisting (11:30 Madrid) or the site does not reflect it yet. Writing this
  // would overwrite the last good flags.json with "all Desconocida" and leave the
  // app without flags.
  // Nada izado NO es un fallo de entrega: es lo que se ve antes del izado
  // (11:30 Madrid) y fuera de temporada. Salia con codigo 1, asi que la pasada
  // de las 11:30 —la primera del dia, justo en el izado— pintaba el workflow en
  // rojo casi a diario y enterraba los fallos de verdad entre el ruido. Se
  // conserva el ultimo estado bueno y se sale en verde; que la ausencia se
  // prolongue lo vigila `flags-freshness`, que para eso esta.
  if (colored === 0) {
    console.warn(
      `\n⚠️  0 banderas con color (todas "No hay información"). Probablemente el scrape\n` +
        `   corrió ANTES del izado (11:30 Madrid) o la web no lo refleja todavía.\n` +
        `   No se sobrescribe flags.json para conservar el último estado bueno.`
    );
    return;
  }

  const out = { generatedAt: new Date().toISOString(), flags };
  const outPath = region.flagsPath;
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(`\n✅ Escrito ${outPath} con ${ok} banderas.`);
}

main().catch((e) => {
  console.error('scrape-flags falló:', e);
  process.exit(1);
});
