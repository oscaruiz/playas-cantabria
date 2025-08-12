import { buildExpressApp } from './express/server';
import { InMemoryCache } from './infrastructure/cache/InMemoryCache';
import { loadConfig } from './infrastructure/config/config';

function wireProcessGuards() {
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[process] Unhandled promise rejection:', reason);
    // No salimos; dejamos el proceso vivo para que Express responda con 5xx
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[process] Uncaught exception:', err);
    // No salimos; podríamos hacer graceful restart si usamos un PM2 / supervisor
  });
}

async function main() {
  wireProcessGuards();

  const cfg = loadConfig();
  const app = buildExpressApp({ cache: new InMemoryCache() });
  const port = cfg.port;

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Listening on http://0.0.0.0:${port}`);
  });

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
  console.error('[server] Fatal error during bootstrap:', err);
  process.exit(1);
});
