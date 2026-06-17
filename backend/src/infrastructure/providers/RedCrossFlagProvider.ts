import fs from 'fs/promises';
import path from 'path';
import { load } from 'cheerio';
import type { Agent } from 'http';
import { http, BROWSER_HEADERS } from '../http/axiosClient';

// https-proxy-agent expone sus tipos vía "exports" map, incompatible con el
// moduleResolution:node de este tsconfig. Se carga por require (any) + shim de tipos.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HttpsProxyAgent } = require('https-proxy-agent') as {
  HttpsProxyAgent: new (url: string) => Agent;
};
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { FlagProvider } from '../../domain/ports/FlagProvider';
import { FlagStatus, FlagColor } from '../../domain/entities/Flag';
import { Config } from '../config/config';

/**
 * Red Cross (Cruz Roja) flag scraper.
 * POST to:
 *   https://www.cruzroja.es/appjv/consPlayas/fichaPlaya.do
 * with form data: { id, action: '', aplicacion: 'consultaPlayas' }
 */
export class RedCrossFlagProvider implements FlagProvider {
  private readonly base = 'https://www.cruzroja.es/appjv/consPlayas';

  // cruzroja.es (WAF F5) devuelve 403 a cualquier IP de datacenter (Render US y EU).
  // Para sortearlo se enruta SOLO esta petición por un proxy residencial / scraping-API
  // si se define SCRAPER_PROXY_URL (p. ej. http://user:pass@host:puerto). Sin la env,
  // va directo (y en prod seguirá dando 403, degradando a null sin romper nada).
  private readonly proxyAgent = process.env.SCRAPER_PROXY_URL
    ? new HttpsProxyAgent(process.env.SCRAPER_PROXY_URL)
    : undefined;

  // Banderas pre-scrapeadas (por la GitHub Action / script local desde IP no
  // bloqueada) y commiteadas en data/flags.json. Es la fuente PRIMARIA en prod,
  // donde el scrape en vivo da 403. Si una playa no está en el fichero, se cae al
  // scrape en vivo (que funciona en local).
  private fileFlags: Map<number, FlagStatus> | null = null;

  constructor(
    private readonly cache: InMemoryCache,
    private readonly flagsFile = 'data/flags.json'
  ) {}

  private async loadFileFlags(): Promise<Map<number, FlagStatus>> {
    if (this.fileFlags) return this.fileFlags;
    const map = new Map<number, FlagStatus>();
    try {
      const raw = JSON.parse(
        await fs.readFile(path.resolve(process.cwd(), this.flagsFile), 'utf-8')
      ) as {
        generatedAt?: string;
        flags: Record<string, { color: string | null; message: string | null; coverageFrom: string | null; coverageTo: string | null; schedule: string | null }>;
      };
      const ts = raw.generatedAt ? Date.parse(raw.generatedAt) || Date.now() : Date.now();
      for (const [id, f] of Object.entries(raw.flags ?? {})) {
        map.set(Number(id), {
          color: (f.color as FlagColor) ?? undefined,
          message: f.message ?? undefined,
          timestamp: ts,
          coverageFrom: f.coverageFrom ?? null,
          coverageTo: f.coverageTo ?? null,
          schedule: f.schedule ?? null
        });
      }
    } catch {
      // sin fichero → mapa vacío → se usará el scrape en vivo
    }
    this.fileFlags = map;
    return map;
  }

  /** Config común del POST a Cruz Roja (cabeceras + proxy opcional). */
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
      // Cuando hay proxy: usar su agente y desactivar el manejo de proxy de axios.
      // rejectUnauthorized:false tolera scraping-APIs que hacen MITM de TLS.
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

  async getFlagByRedCrossId(redCrossId: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;

    // Fuente primaria: banderas pre-scrapeadas (data/flags.json).
    const fromFile = (await this.loadFileFlags()).get(redCrossId);
    if (fromFile) return fromFile;

    const ttl = 86400; // 24h — flags rarely change, reduce scraping load
    const key = CacheKeys.flagByRedCrossId(redCrossId);

    try {
      // El catch externo devuelve null SIN cachear: cruzroja.es es lento e
      // inestable (respuestas de 10-12s y 503 intermitentes tras su WAF F5), así
      // que un fallo no debe quedar cacheado 24h — se reintenta en la siguiente
      // petición y se autocura cuando la web responde.
      return await this.cache.getOrSet(key, ttl, async () => {
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
    } catch {
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

    // Bandera (texto alt de la imagen)
    const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim();

    // Campos adyacentes
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
   * Diagnóstico (no cacheado, no lanza): hace UNA petición a cruzroja.es y
   * devuelve el estado HTTP/tiempo/error reales. Sirve para ver desde el servidor
   * (Render) por qué falla en producción (403/bloqueo vs 503 vs timeout vs 200).
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
