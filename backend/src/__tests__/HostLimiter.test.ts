import { describe, it, expect, vi } from 'vitest';
import { HostLimiter } from '../infrastructure/http/limiter';
import { Ticket } from '../infrastructure/http/priority';

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
    // If it queued, this await would never resolve.
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
    const ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('opendata.aemet.es', undefined);

    expect(limiter.enfriamientoRestanteMs('opendata.aemet.es')).toBe(60_000);
  });

  it('sin Retry-After, cada 429 seguido dobla el enfriamiento hasta el techo', () => {
    // A host blocked for hours (Open-Meteo on the shared Render IP, 7/9-oct-2026)
    // must not get its whole concurrency back every minute.
    const ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    const esperas = Array.from({ length: 6 }, () => {
      limiter.registrar429('api.open-meteo.com', undefined);
      return limiter.enfriamientoRestanteMs('api.open-meteo.com');
    });

    expect(esperas).toEqual([60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
    expect(limiter.snapshot()['api.open-meteo.com'].racha429).toBe(6);
  });

  it('una respuesta buena reinicia la racha: el siguiente 429 vuelve a 60s', () => {
    const ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('api.open-meteo.com', undefined);
    limiter.registrar429('api.open-meteo.com', undefined);
    limiter.registrarExito('api.open-meteo.com');
    limiter.registrar429('api.open-meteo.com', undefined);

    expect(limiter.enfriamientoRestanteMs('api.open-meteo.com')).toBe(60_000);
  });

  it('el Retry-After del servidor manda aunque haya racha', () => {
    const ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('api.openweathermap.org', undefined);
    limiter.registrar429('api.openweathermap.org', undefined);
    limiter.registrar429('api.openweathermap.org', '30');

    expect(limiter.enfriamientoRestanteMs('api.openweathermap.org')).toBe(30_000);
  });

  it('acota el enfriamiento aunque el proveedor pida horas', () => {
    const ahora = 1_000_000;
    const limiter = new HostLimiter({}, () => ahora);

    limiter.registrar429('opendata.aemet.es', '86400');

    expect(limiter.enfriamientoRestanteMs('opendata.aemet.es')).toBe(600_000);
  });

  it('caps requests per rolling minute and lets the next one out when the oldest ages out', async () => {
    vi.useFakeTimers();
    try {
      const host = 'api.openweathermap.org';
      const limiter = new HostLimiter({}, () => Date.now(), { [host]: 3 });
      let sent = 0;
      const send = () => limiter.adquirir(host).then(() => sent++);

      void Promise.all([send(), send(), send(), send(), send()]);
      await vi.advanceTimersByTimeAsync(0);
      expect(sent).toBe(3);

      await vi.advanceTimersByTimeAsync(59_999);
      expect(sent).toBe(3);

      await vi.advanceTimersByTimeAsync(1);
      expect(sent).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('background work yields to calls a user waits on (504 on 10-oct-2026)', () => {
    const host = 'api.openweathermap.org';

    it('serves a waited-for call before background ones already queued for a slot', async () => {
      const limiter = new HostLimiter({ [host]: 1 }, () => 0, {});
      await limiter.adquirir(host, new Ticket());
      const order: string[] = [];
      const queue = (name: string, ticket?: Ticket) =>
        limiter.adquirir(host, ticket).then(() => { order.push(name); limiter.liberar(host); });

      const all = Promise.all([queue('bg1', new Ticket()), queue('bg2', new Ticket()), queue('user')]);
      await new Promise((r) => setTimeout(r, 0)); // let the three reach the slot queue
      limiter.liberar(host);
      await all;

      expect(order).toEqual(['user', 'bg1', 'bg2']);
    });

    it('keeps part of the rate cap out of the background reach', async () => {
      vi.useFakeTimers();
      try {
        const limiter = new HostLimiter({}, () => Date.now(), { [host]: 5 });
        let background = 0;
        for (let i = 0; i < 6; i++) void limiter.adquirir(host, new Ticket()).then(() => background++);
        await vi.advanceTimersByTimeAsync(0);
        expect(background).toBe(3);

        let user = false;
        void limiter.adquirir(host).then(() => { user = true; });
        await vi.advanceTimersByTimeAsync(0);
        expect(user).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not hold a slot while waiting for the rate window', async () => {
      vi.useFakeTimers();
      try {
        const limiter = new HostLimiter({ [host]: 1 }, () => Date.now(), { [host]: 5 });
        for (let i = 0; i < 3; i++) {
          await limiter.adquirir(host, new Ticket());
          limiter.liberar(host);
        }
        // The background lane is full: this one waits for the window...
        void limiter.adquirir(host, new Ticket());
        await vi.advanceTimersByTimeAsync(0);

        // ...and the only slot stays free for a user.
        let user = false;
        void limiter.adquirir(host).then(() => { user = true; });
        await vi.advanceTimersByTimeAsync(0);
        expect(user).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('a promoted ticket stops yielding while it waits', async () => {
      vi.useFakeTimers();
      try {
        const limiter = new HostLimiter({}, () => Date.now(), { [host]: 5 });
        for (let i = 0; i < 3; i++) await limiter.adquirir(host, new Ticket());

        const ticket = new Ticket();
        let sent = false;
        void limiter.adquirir(host, ticket).then(() => { sent = true; });
        await vi.advanceTimersByTimeAsync(5_000);
        expect(sent).toBe(false);

        ticket.promote();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(sent).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('hands the slot straight to the next in line, never counting it free in between', async () => {
    // Freed first and taken back after an await, the slot was up for grabs in
    // between: Codex got 2 in flight with a limit of 1.
    const host = 'api.openweathermap.org';
    const limiter = new HostLimiter({ [host]: 1 }, () => 0, {});
    await limiter.adquirir(host);
    const waiting = limiter.adquirir(host);
    await new Promise((r) => setTimeout(r, 0)); // queued for the slot

    limiter.liberar(host);
    expect(limiter.snapshot()[host].activos).toBe(1);
    await waiting;
    expect(limiter.snapshot()[host].activos).toBe(1);
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
