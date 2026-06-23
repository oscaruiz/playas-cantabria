import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

// Path inexistente para forzar el camino de scrape EN VIVO (sin fuente por fichero).
const NO_FILE = 'data/__no_flags_fixture__.json';

afterEach(() => vi.restoreAllMocks());

describe('RedCrossFlagProvider — scrape en vivo (fallback)', () => {
  it('envía cabeceras de navegador (UA Chrome + Accept-Language es-ES) — fix prod', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache(), NO_FILE);

    await provider.getFlagByRedCrossId(1127);

    expect(spy).toHaveBeenCalledTimes(1);
    const config = spy.mock.calls[0][2] as any;
    const headers = config.headers;
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0.*Chrome/);
    expect(headers['Accept-Language']).toContain('es-ES');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('parsea bandera y cobertura del HTML de ficha', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache(), NO_FILE);

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
    const provider = new RedCrossFlagProvider(new InMemoryCache(), NO_FILE);

    const status = await provider.getFlagByRedCrossId(1127);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(status?.color).toBe('green');
  });

  it('devuelve null si todos los intentos fallan (no cachea el fallo)', async () => {
    const spy = vi.spyOn(http, 'post').mockRejectedValue(new Error('Request failed with status code 403'));
    const provider = new RedCrossFlagProvider(new InMemoryCache(), NO_FILE);

    const first = await provider.getFlagByRedCrossId(1127);
    expect(first).toBeNull();

    // Como el fallo NO se cachea, la 2ª llamada vuelve a intentar (2+2 = 4 posts).
    spy.mockResolvedValue({ data: FICHA_HTML } as any);
    const second = await provider.getFlagByRedCrossId(1127);
    expect(second?.color).toBe('green');
  });
});

describe('RedCrossFlagProvider — fuente primaria por fichero (flags.json)', () => {
  it('sirve la bandera del fichero sin llamar a la red', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flags-'));
    const file = join(dir, 'flags.json');
    writeFileSync(
      file,
      JSON.stringify({
        generatedAt: '2026-06-17T08:00:00.000Z',
        flags: { '555': { color: 'red', message: 'Bandera roja', coverageFrom: '12-06-2026', coverageTo: '15-09-2026', schedule: '11:30 - 19:30' } }
      })
    );
    const spy = vi.spyOn(http, 'post');
    const provider = new RedCrossFlagProvider(new InMemoryCache(), file);

    const status = await provider.getFlagByRedCrossId(555);

    expect(status?.color).toBe('red');
    expect(status?.schedule).toBe('11:30 - 19:30');
    expect(spy).not.toHaveBeenCalled(); // no scrape en vivo
  });

  it('una entrada del fichero SIN color NO tapa el scrape en vivo (cron antes del izado)', async () => {
    // Simula el bug: el cron scrapeó antes de las 11:30 y guardó "No hay información".
    const dir = mkdtempSync(join(tmpdir(), 'flags-'));
    const file = join(dir, 'flags.json');
    writeFileSync(
      file,
      JSON.stringify({
        generatedAt: '2026-06-23T09:56:18.548Z',
        flags: { '555': { color: null, message: 'No hay información', coverageFrom: '12-06-2026', coverageTo: '15-09-2026', schedule: '11:30 - 19:30' } }
      })
    );
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: FICHA_HTML } as any);
    const provider = new RedCrossFlagProvider(new InMemoryCache(), file);

    const status = await provider.getFlagByRedCrossId(555);

    expect(spy).toHaveBeenCalledTimes(1); // intenta el live al no haber color en fichero
    expect(status?.color).toBe('green'); // usa la bandera real izada del scrape
  });

  it('si el live falla y el fichero no tiene color, devuelve el fichero como último recurso', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flags-'));
    const file = join(dir, 'flags.json');
    writeFileSync(
      file,
      JSON.stringify({
        generatedAt: '2026-06-23T09:56:18.548Z',
        flags: { '555': { color: null, message: 'No hay información', coverageFrom: '12-06-2026', coverageTo: '15-09-2026', schedule: '11:30 - 19:30' } }
      })
    );
    vi.spyOn(http, 'post').mockRejectedValue(new Error('Request failed with status code 403'));
    const provider = new RedCrossFlagProvider(new InMemoryCache(), file);

    const status = await provider.getFlagByRedCrossId(555);

    expect(status).not.toBeNull();
    expect(status?.color).toBeUndefined();
    expect(status?.coverageFrom).toBe('12-06-2026'); // conserva la cobertura del fichero
    expect(status?.schedule).toBe('11:30 - 19:30');
  });
});
