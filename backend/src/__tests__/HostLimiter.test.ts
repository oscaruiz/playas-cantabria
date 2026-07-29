import { describe, it, expect } from 'vitest';
import { HostLimiter } from '../infrastructure/http/limiter';

describe('HostLimiter — techo de concurrencia por proveedor', () => {
  it('no deja pasar más peticiones simultáneas que el límite del host', async () => {
    const limiter = new HostLimiter({ 'api.openweathermap.org': 2 });
    let dentro = 0;
    let maxSimultaneas = 0;

    const tarea = async () => {
      await limiter.adquirir('api.openweathermap.org');
      dentro++;
      maxSimultaneas = Math.max(maxSimultaneas, dentro);
      await new Promise((r) => setTimeout(r, 5));
      dentro--;
      limiter.liberar('api.openweathermap.org');
    };

    await Promise.all(Array.from({ length: 10 }, tarea));

    expect(maxSimultaneas).toBe(2);
  });

  it('los hosts sin límite configurado pasan sin encolarse', async () => {
    const limiter = new HostLimiter({ 'api.openweathermap.org': 1 });
    await limiter.adquirir('ejemplo.com');
    await limiter.adquirir('ejemplo.com');
    // Si encolara, este await no resolvería nunca.
    await expect(limiter.adquirir('ejemplo.com')).resolves.toBeUndefined();
  });

  it('un 429 con Retry-After pone el host en enfriamiento', () => {
    let ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('api.openweathermap.org', '30');
    expect(limiter.enfriamientoRestanteMs('api.openweathermap.org')).toBe(30_000);

    ahora += 31_000;
    expect(limiter.enfriamientoRestanteMs('api.openweathermap.org')).toBe(0);
  });

  it('un 429 sin Retry-After usa un enfriamiento por defecto de 60s', () => {
    let ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('opendata.aemet.es', undefined);

    expect(limiter.enfriamientoRestanteMs('opendata.aemet.es')).toBe(60_000);
  });

  it('acota el enfriamiento aunque el proveedor pida horas', () => {
    let ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('opendata.aemet.es', '86400');

    expect(limiter.enfriamientoRestanteMs('opendata.aemet.es')).toBe(600_000);
  });

  it('libera el turno al siguiente en cola sin perder huecos', async () => {
    const limiter = new HostLimiter({ 'www.cruzroja.es': 1 });
    await limiter.adquirir('www.cruzroja.es');

    let segundaEntro = false;
    const segunda = limiter.adquirir('www.cruzroja.es').then(() => {
      segundaEntro = true;
    });

    expect(segundaEntro).toBe(false);
    limiter.liberar('www.cruzroja.es');
    await segunda;
    expect(segundaEntro).toBe(true);
  });
});
