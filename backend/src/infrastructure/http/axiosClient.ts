import axios from 'axios';
import httpModule from 'http';
import https from 'https';

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
