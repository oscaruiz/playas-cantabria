/**
 * Live reachability probe against every external provider, run FROM THE SERVER.
 *
 * `providers:health` used to read `/api/_diag/metrics` and conclude from what
 * it found there. That is not an observation: if the window is empty — a fresh
 * Render process, a cache that served everything, a provider nobody called —
 * the loop visits no host, finds no failure and approves. The incident it
 * exists to catch (Open-Meteo answering 429 to every request from Render for
 * hours) is precisely one where our own traffic is what disappears.
 *
 * So the probe ASKS. One request per provider, now, from the production egress
 * IP — the only place where the answer means anything, since the 429 came from
 * the shared IP of the free tier and not from our quota.
 *
 * It deliberately does not go through the providers: those cache, take
 * coordinates and fall back to each other, and every one of those virtues
 * would let the probe answer without touching the network. The URLs are
 * duplicated here on purpose, kept minimal and cheap (one small payload each),
 * because what is being tested is the host, not the parsing.
 */
import { http } from '../http/axiosClient';
import { HostEnfriadoError } from '../http/limiter';
import { Config } from '../config/config';

/** Santander, a coordinate inside every catalog's bbox neighbourhood. */
const LAT = 43.46;
const LON = -3.8;

const PROBE_TIMEOUT_MS = 8000;

export type ProbeEstado = 'ok' | 'fallo' | 'sin-clave';

export interface ProviderProbeResult {
  host: string;
  estado: ProbeEstado;
  status: number | null;
  ms: number;
  detalle: string | null;
}

interface ProbeSpec {
  host: string;
  /** Returns the URL+params, or null when the provider is not configured. */
  request: () => { url: string; params: Record<string, string | number> } | null;
}

const PROBES: ProbeSpec[] = [
  {
    host: 'api.openweathermap.org',
    request: () => {
      const appid = Config.openWeatherApiKey();
      if (!appid) return null;
      return {
        url: 'https://api.openweathermap.org/data/2.5/weather',
        params: { lat: LAT, lon: LON, appid, units: 'metric' },
      };
    },
  },
  {
    host: 'api.open-meteo.com',
    request: () => ({
      url: 'https://api.open-meteo.com/v1/forecast',
      // The lightest possible answer: one variable, one hour.
      params: { latitude: LAT, longitude: LON, current: 'precipitation', forecast_days: 1 },
    }),
  },
  {
    host: 'opendata.aemet.es',
    request: () => {
      const apiKey = Config.aemetApiKey();
      if (!apiKey) return null;
      // The metadata step only: it answers with the URL of the real payload,
      // which the probe does not download.
      return {
        url: 'https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/3902401',
        params: { api_key: apiKey },
      };
    },
  },
];

async function runProbe(spec: ProbeSpec): Promise<ProviderProbeResult> {
  const request = spec.request();
  if (!request) {
    return { host: spec.host, estado: 'sin-clave', status: null, ms: 0, detalle: 'no API key configured' };
  }

  const started = Date.now();
  try {
    const resp = await http.get(request.url, { params: request.params, timeout: PROBE_TIMEOUT_MS });
    return { host: spec.host, estado: 'ok', status: resp.status, ms: Date.now() - started, detalle: null };
  } catch (error) {
    const e = error as { response?: { status?: number }; code?: string; message?: string };
    // A host in cooldown is not a probe that could not run: it is the failure
    // itself, already detected by the limiter and worth reporting as such.
    const detalle = error instanceof HostEnfriadoError ? 'host enfriado por 429' : e.code ?? e.message ?? 'error';
    return {
      host: spec.host,
      estado: 'fallo',
      status: e.response?.status ?? null,
      ms: Date.now() - started,
      detalle,
    };
  }
}

/** Every provider probed in parallel; never throws. */
export function probeProviders(): Promise<ProviderProbeResult[]> {
  return Promise.all(PROBES.map(runProbe));
}
