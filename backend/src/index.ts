import { buildExpressApp } from './express/server';
import { InMemoryCache } from './infrastructure/cache/InMemoryCache';
import { Config, loadConfig } from './infrastructure/config/config';

async function main() {
  // Load config (dotenv in local/docker; functions.config() in Firebase is handled there)
  const cfg = loadConfig();

  const app = buildExpressApp({ cache: new InMemoryCache() });
  const port = cfg.port;

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Listening on http://0.0.0.0:${port}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}, shutting down...`);
    server.close((err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[server] Error during shutdown:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
