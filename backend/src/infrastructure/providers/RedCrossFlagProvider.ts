import fs from 'fs/promises';
import path from 'path';
import { load } from 'cheerio';
import type { Agent } from 'http';
import { http, BROWSER_HEADERS } from '../http/axiosClient';

// https-proxy-agent exposes its types via "exports" map, incompatible with the
// moduleResolution:node of this tsconfig. Loaded via require (any) + type shim.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HttpsProxyAgent } = require('https-proxy-agent') as {
  HttpsProxyAgent: new (url: string) => Agent;
};
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { FlagProvider } from '../../domain/ports/FlagProvider';
import { FlagStatus, FlagColor, FlagRef } from '../../domain/entities/Flag';
import { readFlagsFile } from '../../regions/flagsFileSchema';
import { MAX_EDAD_BANDERA_MS, vigenciaBandera } from '../../domain/services/flagVigencia';
import { Config } from '../config/config';

/**
 * Red Cross (Cruz Roja) flag scraper.
 * POST to:
 *   https://www.cruzroja.es/appjv/consPlayas/fichaPlaya.do
 * with form data: { id, action: '', aplicacion: 'consultaPlayas' }
 */
export class RedCrossFlagProvider implements FlagProvider {
  private readonly base = 'https://www.cruzroja.es/appjv/consPlayas';

  // ONLY this request goes through an HTTP proxy when SCRAPER_PROXY_URL is set
  // (e.g. http://user:pass@host:puerto). Without the env it goes direct, and if the
  // site answers 403 the flag degrades to null without breaking anything else.
  private readonly proxyAgent = process.env.SCRAPER_PROXY_URL
    ? new HttpsProxyAgent(process.env.SCRAPER_PROXY_URL)
    : undefined;

  // Pre-scraped flags (by the GitHub Action or the local script) and committed in
  // the active region's flags.json. It is the PRIMARY source in prod, where the live
  // scrape often answers nothing. If a beach is not in the file, we fall back to the
  // live scrape.
  private fileFlags: Map<number, FlagStatus> | null = null;
  /** `generatedAt` del fichero, tal cual, para poder decir su edad sin abrir git. */
  private fileGeneratedAt: number | null = null;

  // Circuit breaker for the live scrape. cruzroja.es responds in 10-12s and fails
  // intermittently: with 69 stations, retrying on every request hijacks the single
  // process (0.1 CPU on Render free) without getting anything.
  // After several consecutive failures we stop trying for a while and serve flags.json.
  private fallosSeguidos = 0;
  private abiertoHasta = 0;
  private static readonly FALLOS_PARA_ABRIR = 3;
  private static readonly APERTURA_MS = 15 * 60 * 1000;

  private get circuitoAbierto(): boolean {
    if (this.abiertoHasta === 0) return false;
    if (Date.now() >= this.abiertoHasta) {
      // Half-open: let one attempt through to self-heal.
      this.abiertoHasta = 0;
      this.fallosSeguidos = 0;
      return false;
    }
    return true;
  }

  private anotarResultadoLive(ok: boolean): void {
    if (ok) {
      this.fallosSeguidos = 0;
      this.abiertoHasta = 0;
      return;
    }
    this.fallosSeguidos++;
    if (this.fallosSeguidos >= RedCrossFlagProvider.FALLOS_PARA_ABRIR) {
      this.abiertoHasta = Date.now() + RedCrossFlagProvider.APERTURA_MS;
      console.error(
        `[CRUZ ROJA] ${this.fallosSeguidos} fallos seguidos: scrape en vivo en pausa 15 min (se sirve flags.json)`
      );
    }
  }

  // ---- Barrido de rescate -------------------------------------------------
  // El fichero pre-scrapeado se entrega por commit + redespliegue, asi que su
  // frescura depende del planificador de cron de GitHub, y en este repo va MUY
  // degradado: descarta disparos y los que ejecuta llegan con 1-5 h de retraso.
  // El 1-sep-2026 no ejecuto NINGUNO en todo el dia -ni de este workflow ni de
  // los otros dos-, el fichero de la noche anterior supero las 8 h de
  // `MAX_EDAD_BANDERA_MS` y la app estuvo sin banderas toda la manana sin que
  // nada estuviera roto por nuestra parte. Anadir mas crones no lo arregla:
  // lo que fallo fue el planificador entero, no una entrada concreta.
  //
  // Este barrido saca a GitHub del camino critico. Cuando lo que ibamos a
  // servir YA esta caducado, el backend rellena la cache con UNA pasada
  // acotada, en segundo plano y a la concurrencia 3 del `hostLimiter`.
  private barridoEnCurso: Promise<void> | null = null;
  private proximoBarrido = 0;
  private ultimoBarrido: { at: number; conColor: number; total: number } | null = null;
  /** Sin color: se reintenta pronto (Cruz Roja publica entre las 12:01 y las 18:24). */
  private static readonly REINTENTO_SIN_COLOR_MS = 20 * 60 * 1000;
  /** Con color: la misma cadencia que el cron horario; antes no hay nada que ganar. */
  private static readonly REINTENTO_CON_COLOR_MS = 55 * 60 * 1000;

  constructor(
    private readonly cache: InMemoryCache,
    private readonly flagsFile = 'data/flags.json',
    private readonly regionId = 'cantabria',
  ) {}

  /**
   * Reads the pre-scraped file through the shared schema instead of casting
   * whatever it finds: `color as FlagColor` turned any text into a colour, and
   * an undateable (or future) `generatedAt` used to become `Date.now()` — a
   * capture of unknown age presented as this second's, which is exactly what
   * the 24 h freshness rule exists to stop.
   *
   * A file that cannot be dated is loaded ANYWAY, stamped as already expired.
   * Dropping it looked safer and was the opposite: in production the live
   * scrape answers 403, so discarding the file left the region with NO flags,
   * and a black one stopped excluding its beach — the very failure this work
   * set out to close. Stamped as expired, `vigenciaBandera` reads it as
   * `caducada` and the ranking already knows what to do with that: a
   * restrictive colour keeps excluding, any other degrades to `unknown`.
   *
   * The stamp is a deliberate approximation, and the only one that fails safe:
   * the real age is unknown, and any guess closer to "now" would resurrect the
   * immortal-flag bug. A broken entry is still dropped on its own, without
   * taking the rest of the region with it.
   */
  private async loadFileFlags(): Promise<Map<number, FlagStatus>> {
    if (this.fileFlags) return this.fileFlags;
    const map = new Map<number, FlagStatus>();
    try {
      const raw = JSON.parse(
        await fs.readFile(path.resolve(process.cwd(), this.flagsFile), 'utf-8')
      ) as unknown;
      const { generatedAt, flags, errors } = readFlagsFile(raw);
      if (errors.length > 0) {
        console.error(`[CRUZ ROJA] ${this.flagsFile}: ${errors.length} entrada(s) inválidas: ${errors[0]}`);
      }
      // One millisecond past the freshness window: undateable, therefore expired.
      const ts = generatedAt ?? Date.now() - MAX_EDAD_BANDERA_MS - 1;
      this.fileGeneratedAt = generatedAt ?? null;
      if (generatedAt == null && flags.size > 0) {
        console.error(
          `[CRUZ ROJA] ${this.flagsFile}: sin fecha utilizable; ${flags.size} banderas se sirven como caducadas`,
        );
      }
      for (const [id, f] of flags) {
        map.set(id, {
          color: (f.color as FlagColor) ?? undefined,
          message: f.message ?? undefined,
          timestamp: ts,
          coverageFrom: f.coverageFrom ?? null,
          coverageTo: f.coverageTo ?? null,
          schedule: f.schedule ?? null
        });
      }
    } catch {
      // no file → empty map → the live scrape will be used
    }
    this.fileFlags = map;
    return map;
  }

  /** Common config for the POST to Cruz Roja (headers + optional proxy). */
  private postOptions(timeout: number, raw = false) {
    return {
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Origin: 'https://www.cruzroja.es',
        Referer: `${this.base}/listaPlayas.do`
      },
      timeout,
      // When there is a proxy: use its agent and disable axios's proxy handling.
      // rejectUnauthorized:false tolerates scraping-APIs that do TLS MITM.
      ...(this.proxyAgent ? { httpsAgent: this.proxyAgent, proxy: false as const } : {}),
      ...(raw ? { validateStatus: () => true, transformResponse: (d: unknown) => d } : {})
    };
  }

  private flagBody(redCrossId: number): string {
    return new URLSearchParams({
      id: String(redCrossId),
      action: '',
      aplicacion: 'consultaPlayas'
    }).toString();
  }

  /** FlagProvider port. The router dispatches 'cruzroja' refs here; `ref.ref` is the Cruz Roja id. */
  async getFlag(ref: FlagRef): Promise<FlagStatus | null> {
    return this.getFlagByRedCrossId(ref.ref);
  }

  async getFlagByRedCrossId(redCrossId: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;

    // Primary source: the region's pre-scraped flags.json, but ONLY if the
    // entry carries a real color. An entry without color (e.g. the cron scraped
    // before the 11:30 flag hoisting and stored "No hay información") must NOT shadow
    // the live scrape, which in prod usually does return the already-hoisted flag.
    //
    // La edad NO entra en esta condición, y es deliberado. Se probó a dejar pasar al
    // vivo también las entradas caducadas (>8 h) y sale caro: el fichero está caducado
    // TODOS los días entre las 11:30 —cuando abre la franja— y que aterrice la primera
    // captura hacia las 12:30, porque la última de ayer es de hace más de ocho horas.
    // En esa ventana las 69 estaciones se iban al vivo; con el límite de concurrencia 3
    // de `www.cruzroja.es` y respuestas de 10-12 s, un barrido completo son ~4 min, y un
    // 200 sin color solo se cachea 300 s: el proceso se queda barriendo en bucle
    // (~800 peticiones/hora frente a ~60) sobre los 0,1 CPU de Render free. El circuit
    // breaker no lo frena, porque un 200 sin color cuenta como éxito.
    // Y no compensa: los días en que el fichero se queda viejo, el scrape en vivo bebe
    // de la misma fuente y tampoco trae color. Una bandera caducada la oculta ya
    // `vigenciaBandera`; que la entrega se prolongue lo vigila `flags-freshness`.
    const fromFile = (await this.loadFileFlags()).get(redCrossId);

    // RESCATE. `caducada` significa exactamente esto: hay vigilancia AHORA (dentro
    // de horario y de temporada) y la ultima captura pasa de 8 h, o sea que ondea
    // una bandera y no sabemos cual. No es el fallback vivo por peticion que se
    // descarta arriba: aqui solo se LEE la cache en memoria y se programa un
    // barrido de fondo que la rellena. La diferencia es toda -la peticion del
    // usuario ni espera al scrape ni lo dispara, y el barrido corre como mucho una
    // vez cada 20 min-, y cubre el caso que el cron no cubre: que GitHub descarte
    // todos los disparos del dia y el fichero se quede viejo con el servicio abierto.
    if (fromFile && vigenciaBandera(fromFile) === 'caducada') {
      this.programarBarridoDeRescate();
      const rescatada = this.cache.get<FlagStatus>(
        CacheKeys.flagByRedCrossId(this.regionId, redCrossId)
      );
      if (rescatada?.color) return rescatada;
    }

    if (fromFile?.color) return fromFile;

    // Live scrape (cached). If it carries a real color, it is the freshest truth.
    const live = await this.fetchLiveCached(redCrossId);
    if (live?.color) return live;

    // No color through any path: the file (with its coverage/schedule) is better than
    // nothing; if there is no file either, whatever the live scrape gave; and otherwise, null.
    return fromFile ?? live ?? null;
  }

  /**
   * Lanza el barrido si toca. NO se espera: la peticion en curso no se retrasa
   * ni un milisegundo por el rescate.
   */
  private programarBarridoDeRescate(): void {
    if (this.barridoEnCurso || this.circuitoAbierto) return;
    const ahora = Date.now();
    if (ahora < this.proximoBarrido) return;
    // Se estampa ANTES de empezar: un barrido que revienta tiene que esperar su
    // turno igual que uno que termina, o la siguiente peticion lo relanza en bucle.
    this.proximoBarrido = ahora + RedCrossFlagProvider.REINTENTO_SIN_COLOR_MS;
    this.barridoEnCurso = this.barrerEstaciones()
      .catch(() => undefined)
      .finally(() => {
        this.barridoEnCurso = null;
      });
  }

  /** Una pasada por todas las estaciones del fichero. Rellena la cache (L1 + L2). */
  private async barrerEstaciones(): Promise<void> {
    const ids = [...(await this.loadFileFlags()).keys()];
    if (ids.length === 0) return;
    console.warn(
      `[CRUZ ROJA] fichero caducado: barrido de rescate de ${ids.length} estaciones`
    );
    // Todas a la vez a proposito: el `hostLimiter` las sirve de tres en tres, que
    // es el ritmo que aguanta www.cruzroja.es (~4 min). Un `for` secuencial son ~12.
    const estados = await Promise.all(ids.map((id) => this.fetchLiveCached(id)));
    const conColor = estados.filter((e) => e?.color).length;
    this.ultimoBarrido = { at: Date.now(), conColor, total: ids.length };
    if (conColor > 0) {
      this.proximoBarrido = Date.now() + RedCrossFlagProvider.REINTENTO_CON_COLOR_MS;
    }
    console.warn(`[CRUZ ROJA] barrido de rescate: ${conColor}/${ids.length} con color`);
  }

  /**
   * Estado de la entrega para `/api/_diag/flags`. Es lo primero que hubo que
   * averiguar el 1-sep-2026 y costo un `git fetch` mas un `git show`; aqui es
   * una peticion.
   */
  async snapshotEntrega(): Promise<{
    ficheroGeneradoEn: string | null;
    ficheroEdadHoras: number | null;
    ficheroEstaciones: number;
    barridoEnCurso: boolean;
    proximoBarridoEnSeg: number;
    ultimoBarrido: { at: string; conColor: number; total: number } | null;
  }> {
    const estaciones = (await this.loadFileFlags()).size;
    const ahora = Date.now();
    return {
      ficheroGeneradoEn: this.fileGeneratedAt
        ? new Date(this.fileGeneratedAt).toISOString()
        : null,
      ficheroEdadHoras: this.fileGeneratedAt
        ? Math.round(((ahora - this.fileGeneratedAt) / 3600000) * 10) / 10
        : null,
      ficheroEstaciones: estaciones,
      barridoEnCurso: this.barridoEnCurso !== null,
      proximoBarridoEnSeg: Math.max(0, Math.round((this.proximoBarrido - ahora) / 1000)),
      ultimoBarrido: this.ultimoBarrido
        ? { ...this.ultimoBarrido, at: new Date(this.ultimoBarrido.at).toISOString() }
        : null,
    };
  }

  /** Live scrape with cache and retry. Never throws: returns null on failure. */
  private async fetchLiveCached(redCrossId: number): Promise<FlagStatus | null> {
    // The beach page responds 200 with "No hay información" while no flag is hoisted
    // (before 11:30, and on many beaches a good part of the day). That is a
    // VALID response, so it used to be cached just like a color: 24h. Result: the
    // beach was left without a flag for the rest of the day even if it was hoisted five
    // minutes later, and it shadowed the file on top of that. Without color we re-check soon.
    const TTL_CON_COLOR = 86400; // an already-hoisted flag rarely changes
    const TTL_SIN_COLOR = 300;
    const key = CacheKeys.flagByRedCrossId(this.regionId, redCrossId);

    const cacheado = this.cache.get<FlagStatus>(key);
    if (cacheado !== undefined) return cacheado;

    if (this.circuitoAbierto) return null;

    try {
      // The outer catch returns null WITHOUT caching: cruzroja.es is slow and
      // unstable (10-12s responses and intermittent 503s), so
      // a failure must not stay cached for 24h — it is retried on the next
      // request and self-heals when the site responds.
      const status = await this.cache.getOrSet(key, TTL_SIN_COLOR, async () => {
        const maxAttempts = 2;
        let lastErr: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await this.fetchFlag(redCrossId);
          } catch (err) {
            lastErr = err;
            console.error(
              `[CRUZ ROJA][ERROR][${redCrossId}] intento ${attempt}/${maxAttempts}:`,
              err instanceof Error ? err.message : err
            );
          }
        }
        throw lastErr ?? new Error('cruzroja: sin respuesta');
      });

      // The long TTL is applied ONLY right after computing, never when serving from
      // cache (that's why the `get` above returns early): if it were renewed on every
      // request, a flag with color would never expire as long as there is traffic.
      if (status?.color) this.cache.set(key, status, TTL_CON_COLOR);
      this.anotarResultadoLive(true);
      return status;
    } catch {
      this.anotarResultadoLive(false);
      return null;
    }
  }

  private async fetchFlag(redCrossId: number): Promise<FlagStatus> {
    const resp = await http.post(
      `${this.base}/fichaPlaya.do`,
      this.flagBody(redCrossId),
      this.postOptions(12000)
    );

    const $ = load(resp.data as string);

    // Flag (alt text of the image)
    const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim();

    // Adjacent fields
    const coberturaDesde =
      $('li:contains("Cobertura desde")').next().text().trim() || null;
    const coberturaHasta =
      $('li:contains("Hasta")').next().text().trim() || null;
    const horario =
      $('li:contains("Horario")').next().text().trim() || null;

    const color: FlagColor | undefined = banderaImgAlt
      ? this.detectColorFromAlt(banderaImgAlt)
      : undefined;

    return {
      color,
      message: banderaImgAlt,
      timestamp: Date.now(),
      coverageFrom: coberturaDesde,
      coverageTo: coberturaHasta,
      schedule: horario
    };
  }

  /**
   * Diagnostic (not cached, does not throw): makes ONE request to cruzroja.es and
   * returns the real HTTP status/time/error. Useful to see from the server
   * (Render) why it fails in production (403/block vs 503 vs timeout vs 200).
   */
  async probe(redCrossId: number): Promise<{
    httpStatus: number | null;
    ok: boolean;
    elapsedMs: number;
    foundColor: string | null;
    bytes: number | null;
    server: string | null;
    errorName: string | null;
    errorMessage: string | null;
  }> {
    const start = Date.now();
    try {
      const resp = await http.post(
        `${this.base}/fichaPlaya.do`,
        this.flagBody(redCrossId),
        this.postOptions(13000, true)
      );
      const html = typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
      const $ = load(html);
      const alt = $('#listaFicha img[alt]').attr('alt')?.trim();
      return {
        httpStatus: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        elapsedMs: Date.now() - start,
        foundColor: alt ? this.detectColorFromAlt(alt) ?? null : null,
        bytes: html.length,
        server: (resp.headers?.['server'] as string) ?? null,
        errorName: null,
        errorMessage: null
      };
    } catch (err: any) {
      return {
        httpStatus: null,
        ok: false,
        elapsedMs: Date.now() - start,
        foundColor: null,
        bytes: null,
        server: null,
        errorName: err?.code || err?.name || 'Error',
        errorMessage: err?.message || String(err)
      };
    }
  }

  /**
   * Detects flag color strictly from the alt text.
   * Returns undefined when not detectable.
   */
  private detectColorFromAlt(alt: string): FlagColor | undefined {
    const s = alt.toLowerCase();

    if (s.includes('roja')) return 'red';
    if (s.includes('amarilla')) return 'yellow';
    if (s.includes('verde')) return 'green';
    if (s.includes('negra')) return 'black';

    return undefined;
  }
}
