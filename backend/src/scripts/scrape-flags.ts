/**
 * Scrapes the Cruz Roja flags and writes the active region's flags.json.
 *
 * Meant to run:
 *  - in GitHub Actions (cron) → commits the flags.json that the backend serves, or
 *  - locally, as a fallback when the scheduled run is not delivering.
 *
 * Prints the HTTP status of every fiche so a pass that brings nothing says why.
 *
 * Cada pasada deja además `flags-diag.json` al lado del fichero de banderas, y lo
 * deja SIEMPRE, también cuando la pasada falla. Del 14 al 16-ago-2026 la entrega
 * estuvo rota 34 h y lo único que lo habría explicado —qué contestaron las
 * fichas— vivía en el log de Actions, que hace falta autenticarse para leer.
 * Commiteado al repo, un día malo deja prueba por sí solo.
 *
 *   Usage: npm run scrape:flags   (cwd = backend/)
 */
import fs from 'fs/promises';
import path from 'path';
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

/** Pause between fiches: 69 POSTs back to back would be a burst on a small site. */
const PAUSA_MS = 400;
/** Attempts per fiche. The site fails intermittently, so a second try often lands. */
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

/**
 * Lo que la pasada vio, para que un día malo se explique sin abrir el log de
 * Actions (que hace falta autenticarse para descargar).
 */
interface Diagnostico {
  ranAt: string;
  region: string;
  ids: number;
  conFicha: number;
  conColor: number;
  rechazadas403: number;
  estadosHttp: Record<string, number>;
  /**
   * What the fiches actually SAID when they said no colour. A real
   * "No hay información" and a page that simply came back without the data are
   * both 200-without-colour, and used to print the same `??`: the log could not
   * tell a quiet beach from a pass that got nothing. Now it can.
   */
  alts: Record<string, number>;
  escrito: boolean;
  motivo: string;
}

const diagPath = path.join(region.regionDir, 'flags-diag.json');

/**
 * El fichero es la evidencia de lo que ve la pasada programada, y por eso sólo lo
 * escribe Actions. Una ejecución a mano —que es la otra mitad de la comparación—
 * machacaría con sus propios datos justo la captura del día malo que hay que
 * comparar. En local va por consola, que es donde lo lee quien la lanzó.
 */
async function escribirDiag(diag: Diagnostico): Promise<void> {
  const json = JSON.stringify(diag, null, 2);
  if (process.env.GITHUB_ACTIONS !== 'true') {
    console.log(`\nDiagnóstico de esta pasada (local: no se escribe el fichero):\n${json}`);
    return;
  }
  try {
    await fs.writeFile(diagPath, json + '\n', 'utf-8');
    console.log(`Diagnóstico en ${diagPath}`);
  } catch (e: any) {
    // Nunca fatal: el diagnóstico existe para explicar un fallo, no para causarlo.
    console.warn(`No se pudo escribir el diagnóstico (${e?.message}).`);
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
  const altCount: Record<string, number> = {};

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
      const alt = r.flag.message ?? '(sin alt)';
      altCount[alt] = (altCount[alt] ?? 0) + 1;
      console.log(`  id ${id}: ${r.status} -> ${r.flag.color ?? `?? "${alt}"`}`);
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

  const diag: Diagnostico = {
    ranAt: new Date().toISOString(),
    region: region.id,
    ids: ids.length,
    conFicha: ok,
    conColor: colored,
    rechazadas403: blocked,
    estadosHttp: statusCount,
    alts: altCount,
    escrito: false,
    motivo: ''
  };

  // Ni 0 fichas ni "casi ninguna". Exigir el cero absoluto dejaba pasar la
  // respuesta parcial: con que UNA ficha de 69 contestara, el script seguía y
  // escribía un flags.json al que le faltaban las otras 68 playas —o, si esa
  // única ficha venía sin color, se iba por la rama silenciosa de abajo—.
  // `<` y no `<=`: la regla es "falla si contesta MENOS de la mitad". Con
  // `<= Math.floor(n/2)` una región de 2 estaciones con 1 respuesta —media, no
  // menos— salía en rojo. Con 69 el resultado es el mismo (hacen falta 35).
  if (ok < ids.length / 2) {
    diag.motivo = 'demasiadas fichas sin respuesta';
    await escribirDiag(diag);
    console.error(
      `\n❌ Solo ${ok}/${ids.length} fichas obtenidas (${blocked} con 403).\n` +
        `   Estados: ${JSON.stringify(statusCount)}\n` +
        `   No se sobrescribe flags.json: se conserva el último estado bueno.`
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
  //
  // Se probó a ponerlo en rojo cuando la franja de vigilancia ya está abierta, y
  // no se sostiene: la franja abre a las 11:30 pero Cruz Roja no publica hasta
  // las 12:01-12:44 (medido sobre nueve días buenos), así que una pasada de las
  // 11:49 —las hubo el 15 y el 16-ago-2026— saldría roja en un día impecable.
  // Esperar tres horas para no mentir deja el aviso a las 14:30, y
  // `flags-freshness` ya avisa a las 14:00. Una alarma, en un sitio.
  if (colored === 0) {
    const alts = Object.entries(altCount)
      .sort((a, b) => b[1] - a[1])
      .map(([alt, n]) => `"${alt}" ×${n}`)
      .join(', ');
    diag.motivo = 'sin banderas izadas';
    await escribirDiag(diag);
    console.warn(
      `\n⚠️  0 banderas con color (todas "No hay información"). Probablemente el scrape\n` +
        `   corrió ANTES del izado (11:30 Madrid) o la web no lo refleja todavía.\n` +
        `   ${ok}/${ids.length} fichas contestaron. Alt recibidos: ${alts || '(ninguno)'}\n` +
        `   Estados: ${JSON.stringify(statusCount)}\n` +
        `   No se sobrescribe flags.json para conservar el último estado bueno.`
    );
    return;
  }

  const out = { generatedAt: new Date().toISOString(), flags };
  const outPath = region.flagsPath;
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  diag.escrito = true;
  diag.motivo = 'captura escrita';
  await escribirDiag(diag);
  console.log(`\n✅ Escrito ${outPath} con ${ok} banderas.`);
}

main().catch((e) => {
  console.error('scrape-flags falló:', e);
  process.exit(1);
});
