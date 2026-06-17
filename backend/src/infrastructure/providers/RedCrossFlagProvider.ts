import { load } from 'cheerio';
import { http, BROWSER_HEADERS } from '../http/axiosClient';
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

  constructor(private readonly cache: InMemoryCache) {}

  async getFlagByRedCrossId(redCrossId: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;

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
      new URLSearchParams({
        id: String(redCrossId),
        action: '',
        aplicacion: 'consultaPlayas'
      }).toString(),
      {
        // Cabeceras de navegador (cruzroja.es filtra el UA por defecto) + timeout
        // amplio: su WAF responde en 10-12s y a veces da 503.
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Origin: 'https://www.cruzroja.es',
          Referer: `${this.base}/listaPlayas.do`
        },
        timeout: 15000
      }
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
        new URLSearchParams({ id: String(redCrossId), action: '', aplicacion: 'consultaPlayas' }).toString(),
        {
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Origin: 'https://www.cruzroja.es',
            Referer: `${this.base}/listaPlayas.do`
          },
          timeout: 13000,
          validateStatus: () => true,
          transformResponse: (d) => d
        }
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
