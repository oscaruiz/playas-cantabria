import cors from 'cors';
import { Config } from '../../infrastructure/config/config';

export function corsMiddleware() {
  const origin = Config.corsOrigin();
  return cors({ origin, credentials: true });
}
