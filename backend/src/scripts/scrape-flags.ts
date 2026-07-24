/**
 * Scrapea las banderas de Cruz Roja de todas las playas y escribe data/flags.json.
 *
 * Pensado para ejecutarse:
 *  - en GitHub Actions (cron) → commitea flags.json que el backend sirve, o
 *  - en local (IP residencial española) como respaldo si Azure/GitHub está bloqueado.
 *
 * cruzroja.es (WAF F5) devuelve 403 a IPs de datacenter. Este script imprime el
 * estado HTTP de cada playa para ver claramente si el entorno está bloqueado.
 *
 *   Uso: npm run scrape:flags   (cwd = backend/)
 */
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { load } from 'cheerio';

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

async function fetchOne(id: number): Promise<{ status: number | null; flag: StoredFlag | null; err?: string }> {
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
  const dataDir = path.resolve(process.cwd(), 'data');
  const beaches = JSON.parse(await fs.readFile(path.join(dataDir, 'beaches.json'), 'utf-8')) as Array<{
    nombre: string;
    idCruzRoja?: number;
    cruzRojaStations?: Array<{ id?: number; nombreFuente: string }>;
  }>;

  // Recolecta ids de la playa única (idCruzRoja) Y de todos los puestos
  // (cruzRojaStations) de las playas multi-puesto.
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

  for (const id of ids) {
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

  // Si ninguna playa tiene color (todas "No hay información"), el scrape se ejecutó
  // ANTES del izado (11:30 Madrid) o la web aún no lo refleja. Escribir esto pisaría
  // el último flags.json bueno con "todo Desconocida" y dejaría la app sin banderas.
  if (colored === 0) {
    console.error(
      `\n⚠️  0 banderas con color (todas "No hay información"). Probablemente el scrape\n` +
        `   corrió ANTES del izado (11:30 Madrid) o la web no lo refleja todavía.\n` +
        `   No se sobrescribe flags.json para conservar el último estado bueno.`
    );
    process.exit(1);
  }

  const out = { generatedAt: new Date().toISOString(), flags };
  const outPath = path.join(dataDir, 'flags.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(`\n✅ Escrito ${outPath} con ${ok} banderas.`);
}

main().catch((e) => {
  console.error('scrape-flags falló:', e);
  process.exit(1);
});
