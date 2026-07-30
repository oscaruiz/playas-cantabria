/**
 * A `fetch` double for tests, with no dependencies.
 *
 * It was written by hand instead of using MSW because react-scripts 5 pins jest 27,
 * which does not resolve msw@2's `exports` map, and msw@1 (EOL) fights with
 * `jest.useFakeTimers()` — exactly what the tests for the 2.5 s race and the
 * cache TTL need. The API mimics MSW's shape so that migrating later
 * (after moving to Vite) is mechanical.
 *
 * IMPORTANT: CRA enables `resetMocks: true`, so `installFetchMock()` must be
 * called inside a `beforeEach`, never in the body of the `describe`.
 */

type Matcher = string | RegExp | ((url: string) => boolean);

export interface RouteSpec {
  /** Body that `response.json()` will return. */
  json?: unknown;
  /** Defaults to 200. */
  status?: number;
  /** Delays the response with `setTimeout` (compatible with fake timers). */
  delayMs?: number;
  /** Rejects the `fetch` promise, as a network failure would. */
  networkError?: string | boolean;
}

/** A fixed `RouteSpec`, or a function that produces one (possibly async). */
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

/** Lets a test decide *when* a response arrives, not just how long it takes. */
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
 * Replaces `globalThis.fetch`. The first route that matches wins; a URL with no
 * matching route fails the test with an explicit message instead of hanging.
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
 * Drains the microtask queue. Needed after `jest.advanceTimersByTime()`,
 * because jest 27 does not have `advanceTimersByTimeAsync`. The chains that have
 * to be drained (including the fallback's dynamic `import()`, which babel turns into
 * `Promise.resolve().then(require)`) are only microtasks, so it is enough to
 * yield the turn several times.
 */
export async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
