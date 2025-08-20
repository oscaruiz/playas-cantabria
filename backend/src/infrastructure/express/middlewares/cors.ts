import cors from 'cors';
import { Config } from '../../config/config';

export function corsMiddleware() {
  const originCfg = Config.corsOrigin();

  // Support comma-separated list of origins
  const origins = originCfg
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);

  const origin = origins.length > 1 ? origins : origins[0] || '*';

  // Do not send credentials with wildcard origin (browser blocks it)
  const credentials = origin !== '*';

  return cors({
    origin,
    credentials,
    maxAge: 86400,
  });
}
