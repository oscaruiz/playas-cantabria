import { load } from 'cheerio';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { FlagProvider } from '../../domain/ports/FlagProvider';
import { FlagStatus, FlagColor } from '../../domain/entities/Flag';
import { Config } from '../config/config';

/**
 * Red Cross (Cruz Roja) flag scraper.
 * As per your notes, POST to:
 *   https://www.cruzroja.es/appjv/consPlayas/fichaPlaya.do
 * with form data: { id, action: '', aplicacion: 'consultaPlayas' }
 */
export class RedCrossFlagProvider implements FlagProvider {
  private readonly base = 'https://www.cruzroja.es/appjv/consPlayas';

  constructor(private readonly cache: InMemoryCache) {}

  async getFlagByRedCrossId(redCrossId: number): Promise<FlagStatus | null> {
    if (!redCrossId || redCrossId <= 0) return null;

    const ttl = Config.cacheTtlSeconds();
    const key = CacheKeys.flagByRedCrossId(redCrossId);
    return this.cache.getOrSet(key, ttl, async () => {
      try {
        const resp = await http.post(
          `${this.base}/fichaPlaya.do`,
          new URLSearchParams({
            id: String(redCrossId),
            action: '',
            aplicacion: 'consultaPlayas'
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
          }
        );

        const $ = load(resp.data as string);

        // Bandera (texto alt de la imagen)
        const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim() || '';

        // Campos adyacentes
        const coberturaDesde = $('li:contains("Cobertura desde")').next().text().trim() || null;
        const coberturaHasta = $('li:contains("Hasta")').next().text().trim() || null;
        const horario = $('li:contains("Horario")').next().text().trim() || null;

        const color = this.detectColorFromAlt(banderaImgAlt) ?? this.detectColor(($('body').text() || '').toLowerCase());

        const status: FlagStatus = {
          color,
          message: banderaImgAlt || undefined,
          timestamp: Date.now(),
          coverageFrom: coberturaDesde,
          coverageTo: coberturaHasta,
          schedule: horario,
        };
        return status;
      } catch {
        return null;
      }
    });
  }

  private detectColor(text: string): FlagColor {
    if (text.includes('bandera roja') || text.includes('roja')) return 'red';
    if (text.includes('bandera amarilla') || text.includes('amarilla')) return 'yellow';
    if (text.includes('bandera verde') || text.includes('verde')) return 'green';
    if (text.includes('bandera negra') || text.includes('negra')) return 'black';
    return 'unknown';
  }

  private detectColorFromAlt(alt: string): FlagColor | null {
    const s = alt.toLowerCase();
    if (s.includes('roja')) return 'red';
    if (s.includes('amarilla')) return 'yellow';
    if (s.includes('verde')) return 'green';
    if (s.includes('negra')) return 'black';
    return null;
  }
}
