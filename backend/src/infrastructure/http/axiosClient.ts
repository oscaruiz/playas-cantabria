import axios from 'axios';
import httpModule from 'http';
import https from 'https';

const httpAgent = new httpModule.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 20,
  timeout: 10000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 20,
  timeout: 10000
});

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
