/**
 * Doble de `fetch` para tests, sin dependencias.
 *
 * Se escribió a mano en lugar de usar MSW porque react-scripts 5 fija jest 27,
 * que no resuelve los `exports` map de msw@2, y msw@1 (EOL) pelea con
 * `jest.useFakeTimers()` — justo lo que necesitan los tests de la carrera de
 * 2.5 s y del TTL de caché. La API imita la forma de MSW para que migrar más
 * adelante (tras pasar a Vite) sea mecánico.
 *
 * IMPORTANTE: CRA activa `resetMocks: true`, así que `installFetchMock()` debe
 * llamarse dentro de un `beforeEach`, nunca en el cuerpo del `describe`.
 */

type Matcher = string | RegExp | ((url: string) => boolean);

export interface RouteSpec {
  /** Cuerpo que devolverá `response.json()`. */
  json?: unknown;
  /** Por defecto 200. */
  status?: number;
  /** Retrasa la respuesta con `setTimeout` (compatible con fake timers). */
  delayMs?: number;
  /** Rechaza la promesa de `fetch`, como haría un fallo de red. */
  networkError?: string | boolean;
}

/** Un `RouteSpec` fijo, o una función que lo produce (posiblemente async). */
type SpecSource = RouteSpec | (() => RouteSpec | Promise<RouteSpec>);

export interface Route {
  matcher: Matcher;
  spec: SpecSource;
}

export function route(matcher: Matcher, spec: SpecSource): Route {
  return { matcher, spec };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/** Permite a un test decidir *cuándo* llega una respuesta, no solo cuánto tarda. */
export function deferred<T = RouteSpec>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function matches(matcher: Matcher, url: string): boolean {
  if (typeof matcher === 'string') return url.includes(matcher);
  if (matcher instanceof RegExp) return matcher.test(url);
  return matcher(url);
}

function buildResponse(spec: RouteSpec): Response {
  const status = spec.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(spec.json),
  } as unknown as Response;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let originalFetch: typeof globalThis.fetch | undefined;
let installed = false;

export type FetchMock = jest.Mock<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>;

/**
 * Sustituye `globalThis.fetch`. La primera ruta que casa gana; una URL sin ruta
 * que case hace fallar el test con un mensaje explícito en vez de colgarse.
 */
export function installFetchMock(routes: Route[]): FetchMock {
  if (!installed) {
    originalFetch = globalThis.fetch;
    installed = true;
  }

  const mock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const found = routes.find((r) => matches(r.matcher, url));

    if (!found) {
      throw new Error(
        `[fakeFetch] Ninguna ruta casa con "${url}". Rutas declaradas: ${routes
          .map((r) => String(r.matcher))
          .join(', ')}`,
      );
    }

    const spec = typeof found.spec === 'function' ? await found.spec() : found.spec;

    if (spec.delayMs) await wait(spec.delayMs);

    if (spec.networkError) {
      throw new Error(
        typeof spec.networkError === 'string' ? spec.networkError : 'Network request failed',
      );
    }

    return buildResponse(spec);
  }) as FetchMock;

  globalThis.fetch = mock as unknown as typeof globalThis.fetch;
  return mock;
}

export function restoreFetch(): void {
  if (!installed) return;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete (globalThis as { fetch?: unknown }).fetch;
  }
  installed = false;
  originalFetch = undefined;
}

/**
 * Vacía la cola de microtareas. Necesario tras `jest.advanceTimersByTime()`,
 * porque jest 27 no tiene `advanceTimersByTimeAsync`. Las cadenas que hay que
 * drenar (incluido el `import()` dinámico del fallback, que babel convierte en
 * `Promise.resolve().then(require)`) son solo microtareas, así que basta con
 * ceder el turno varias veces.
 */
export async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
