import axios from 'axios';
import httpModule from 'http';
import https from 'https';
import { httpMetrics, hostOf } from './metrics';
import { hostLimiter, HostEnfriadoError } from './limiter';

const httpAgent = new httpModule.Agent({
  keepAlive: true,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 10000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 10000
});

/**
 * Browser headers (UA + language) for scraping websites that filter bots.
 * Needed in production: sites like cruzroja.es or aemet.es reject the default
 * UA from datacenter IPs. Each caller adds its own `Accept`.
 */
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
} as const;

/**
 * Shared Axios instance with sensible defaults + keep-alive.
 * Providers can override timeouts per request.
 */
export const http = axios.create({
  timeout: 7000,
  httpAgent,
  httpsAgent,
  decompress: true,
  headers: {
    'User-Agent': 'Playas-Cantabria-Backend/1.0',
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8'
  }
});

/** Internal mark to avoid releasing the same semaphore slot twice. */
const HOST_TOMADO = Symbol('hostTomado');

// Takes a turn BEFORE going out to the network. If the host is cooling down from a
// previous 429, fail fast: the provider has stale-while-revalidate, so the
// user receives the last good value instead of another call that would also be
// rejected.
//
// The cooldown is checked AFTER taking a turn, and this is the important part:
// in a fan-out, requests come in all at once and sit waiting in the
// semaphore queue. If it were only checked on entry, all of them would have passed the check
// before the first response brought the 429, and would go out anyway. That was
// exactly what was observed against AEMET: six 429s in a row instead of one.
http.interceptors.request.use(async (config: any) => {
  const host = hostOf(config?.url, config?.baseURL);
  const rechazaSiEnfriando = () => {
    const restante = hostLimiter.enfriamientoRestanteMs(host);
    if (restante > 0) throw new HostEnfriadoError(host, restante);
  };

  rechazaSiEnfriando(); // cheap: avoids queueing what is already doomed

  await hostLimiter.adquirir(host);
  try {
    rechazaSiEnfriando(); // the 429 may have arrived while waiting for a turn
  } catch (e) {
    hostLimiter.liberar(host);
    throw e;
  }

  config[HOST_TOMADO] = host;
  return config;
});

// Counts EVERY outgoing request (a single time, here) so the real quota
// consumption can be seen in /api/_diag/metrics, and releases the turn. It does not
// alter the flow: it re-emits the error as-is.
const liberar = (cfg: any) => {
  const host = cfg?.[HOST_TOMADO];
  if (host) {
    delete cfg[HOST_TOMADO];
    hostLimiter.liberar(host);
  }
};

http.interceptors.response.use(
  (resp) => {
    httpMetrics.record(hostOf(resp.config?.url, resp.config?.baseURL), resp.status);
    liberar(resp.config);
    return resp;
  },
  (error: any) => {
    const cfg = error?.config;
    const host = hostOf(cfg?.url, cfg?.baseURL);
    const status = error?.response?.status ?? null;
    if (status === 429) hostLimiter.registrar429(host, error?.response?.headers?.['retry-after']);
    // A rejection from the request interceptor itself never took a turn.
    if (error?.code !== 'HOST_COOLDOWN') httpMetrics.record(host, status);
    liberar(cfg);
    return Promise.reject(error);
  }
);
