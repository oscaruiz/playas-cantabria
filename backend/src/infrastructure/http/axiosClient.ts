import axios from 'axios';

/**
 * Shared Axios instance with sensible defaults.
 * Providers may override per-request timeouts if needed.
 */
export const http = axios.create({
  timeout: 8000, // 8s sane default
  headers: {
    'User-Agent': 'Playas-Cantabria-Backend/1.0 (+https://example.local)', // adjust if needed
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
  },
  // validateStatus keeps default (>=200 < 300)
});
