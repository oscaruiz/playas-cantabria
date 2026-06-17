import { describe, it, expect, vi, afterEach } from 'vitest';
import { RedCrossFlagProvider } from '../infrastructure/providers/RedCrossFlagProvider';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { http } from '../infrastructure/http/axiosClient';

// HTML mínimo con la estructura que parsea el provider (ficha de playa Cruz Roja).
const FICHA_HTML = `
<html><body>
  <div id="listaFicha">
    <img alt="Bandera verde" src="/img/verde.png" />
    <ul>
      <li>Cobertura desde</li><li>12-06-2026</li>
      <li>Hasta</li><li>15-09-2026</li>
      <li>Horario</li><li>11:30 - 19:30</li>
    </ul>
  </div>
</body></html>`;

afterEach(() => vi.restoreAllMocks());

describe('RedCrossFlagProvider', () => {
  it('envía cabeceras de navegador (UA Chrome + Accept-Language es-ES) — fix prod', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache());

    await provider.getFlagByRedCrossId(1127);

    expect(spy).toHaveBeenCalledTimes(1);
    const config = spy.mock.calls[0][2] as any;
    const headers = config.headers;
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0.*Chrome/);
    expect(headers['Accept-Language']).toContain('es-ES');
    // Se mantiene el content-type del POST de formulario.
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('parsea bandera y cobertura del HTML de ficha', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache());

    const status = await provider.getFlagByRedCrossId(1127);

    expect(status?.color).toBe('green');
    expect(status?.coverageFrom).toBe('12-06-2026');
    expect(status?.coverageTo).toBe('15-09-2026');
    expect(status?.schedule).toBe('11:30 - 19:30');
  });

  it('reintenta una vez ante fallo transitorio (503/timeout) y devuelve la bandera', async () => {
    const spy = vi
      .spyOn(http, 'post')
      .mockRejectedValueOnce(new Error('Request failed with status code 503'))
      .mockResolvedValueOnce({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache());

    const status = await provider.getFlagByRedCrossId(1127);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(status?.color).toBe('green');
  });

  it('devuelve null si todos los intentos fallan (no cachea el fallo)', async () => {
    const spy = vi.spyOn(http, 'post').mockRejectedValue(new Error('Request failed with status code 403'));
    const cache = new InMemoryCache();
    const provider = new RedCrossFlagProvider(cache);

    const first = await provider.getFlagByRedCrossId(1127);
    expect(first).toBeNull();

    // Segunda llamada: si el fallo se hubiera cacheado, no reintentaría. Como NO
    // se cachea, vuelve a intentar (2 intentos por llamada → 4 en total).
    spy.mockResolvedValue({ data: FICHA_HTML } as any);
    const second = await provider.getFlagByRedCrossId(1127);
    expect(second?.color).toBe('green');
  });
});
