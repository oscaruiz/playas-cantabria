import { describe, it, expect } from 'vitest';
import { rateLimit } from '../infrastructure/express/middlewares/rateLimit';

/** Doble mínimo de req/res para ejercitar el middleware sin levantar Express. */
function ejecutar(middleware: ReturnType<typeof rateLimit>, ip: string) {
  const cabeceras: Record<string, string> = {};
  let estado: number | null = null;
  let siguiente = false;

  const req = { ip, socket: {} } as any;
  const res = {
    setHeader: (k: string, v: string) => {
      cabeceras[k] = v;
    },
    status(code: number) {
      estado = code;
      return this;
    },
    json: () => undefined,
  } as any;

  middleware(req, res, () => {
    siguiente = true;
  });

  return { estado, siguiente, cabeceras };
}

describe('rateLimit', () => {
  it('deja pasar hasta el máximo y corta a partir de ahí', () => {
    const mw = rateLimit({ ventanaMs: 60_000, maxPeticiones: 3 });

    for (let i = 0; i < 3; i++) {
      expect(ejecutar(mw, '1.2.3.4').siguiente).toBe(true);
    }

    const cuarta = ejecutar(mw, '1.2.3.4');
    expect(cuarta.siguiente).toBe(false);
    expect(cuarta.estado).toBe(429);
    expect(cuarta.cabeceras['Retry-After']).toBeDefined();
  });

  it('cuenta por IP: un abusón no bloquea a los demás', () => {
    const mw = rateLimit({ ventanaMs: 60_000, maxPeticiones: 2 });

    ejecutar(mw, '1.2.3.4');
    ejecutar(mw, '1.2.3.4');
    expect(ejecutar(mw, '1.2.3.4').estado).toBe(429);

    // Otro usuario, cupo intacto.
    expect(ejecutar(mw, '5.6.7.8').siguiente).toBe(true);
  });

  it('reabre el cupo al cambiar de ventana', () => {
    let ahora = 1_000_000;
    const mw = rateLimit({ ventanaMs: 60_000, maxPeticiones: 1, now: () => ahora });

    expect(ejecutar(mw, '1.2.3.4').siguiente).toBe(true);
    expect(ejecutar(mw, '1.2.3.4').estado).toBe(429);

    ahora += 60_001;
    expect(ejecutar(mw, '1.2.3.4').siguiente).toBe(true);
  });

  it('no revienta si no hay IP disponible', () => {
    const mw = rateLimit({ maxPeticiones: 1 });
    const req = { socket: {} } as any;
    let paso = false;
    mw(req, { setHeader: () => undefined, status: () => ({ json: () => undefined }) } as any, () => {
      paso = true;
    });
    expect(paso).toBe(true);
  });
});
