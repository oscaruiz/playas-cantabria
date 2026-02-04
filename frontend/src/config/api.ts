const DEFAULT_API_BASE_URL = 'https://playas-cantabria.onrender.com';

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const resolveApiBaseUrl = (): string => {
  const rawValue = process.env.REACT_APP_API_BASE_URL?.trim();

  if (!rawValue) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
    return normalizeBaseUrl(parsed.toString());
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[config] Invalid REACT_APP_API_BASE_URL, falling back to default.',
        error
      );
    }
    return DEFAULT_API_BASE_URL;
  }
};

/**
 * Single source of truth for the API base URL.
 * Override per-environment with REACT_APP_API_BASE_URL in .env files.
 */
export const API_BASE_URL = resolveApiBaseUrl();

export const buildApiUrl = (path: string): string => {
  if (!path) return API_BASE_URL;
  return path.startsWith('/')
    ? `${API_BASE_URL}${path}`
    : `${API_BASE_URL}/${path}`;
};
