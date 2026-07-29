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
 * Cabeceras de navegador (UA + idioma) para scraping de webs que filtran bots.
 * Necesario en producción: webs como cruzroja.es o aemet.es rechazan el UA por
 * defecto desde IPs de datacenter. Cada llamante añade su propio `Accept`.
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

/** Marca interna para no liberar dos veces el mismo hueco del semáforo. */
const HOST_TOMADO = Symbol('hostTomado');

// Toma turno ANTES de salir a la red. Si el host está enfriándose por un 429
// previo, se falla rápido: el proveedor tiene stale-while-revalidate, así que el
// usuario recibe el último valor bueno en vez de otra llamada que también sería
// rechazada.
//
// El enfriamiento se comprueba DESPUÉS de coger turno, y esto es lo importante:
// en un fan-out, las peticiones entran todas a la vez y se quedan esperando en la
// cola del semáforo. Si se mirase solo al entrar, todas habrían pasado el control
// antes de que la primera respuesta trajera el 429, y saldrían igualmente. Fue
// exactamente lo observado contra AEMET: seis 429 seguidos en vez de uno.
http.interceptors.request.use(async (config: any) => {
  const host = hostOf(config?.url, config?.baseURL);
  const rechazaSiEnfriando = () => {
    const restante = hostLimiter.enfriamientoRestanteMs(host);
    if (restante > 0) throw new HostEnfriadoError(host, restante);
  };

  rechazaSiEnfriando(); // barato: evita encolar lo que ya está condenado

  await hostLimiter.adquirir(host);
  try {
    rechazaSiEnfriando(); // el 429 puede haber llegado mientras esperaba turno
  } catch (e) {
    hostLimiter.liberar(host);
    throw e;
  }

  config[HOST_TOMADO] = host;
  return config;
});

// Contabiliza TODA petición saliente (una sola vez, aquí) para poder ver el
// consumo real de cuota en /api/_diag/metrics, y libera el turno. No altera el
// flujo: reemite el error tal cual.
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
    // Un rechazo del propio interceptor de petición no llegó a tomar turno.
    if (error?.code !== 'HOST_COOLDOWN') httpMetrics.record(host, status);
    liberar(cfg);
    return Promise.reject(error);
  }
);
