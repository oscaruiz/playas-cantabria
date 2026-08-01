import type { Server } from 'node:http';
import { buildExpressApp, REQUEST_TIMEOUT_MS } from './infrastructure/express/server';
import { InMemoryCache } from './infrastructure/cache/InMemoryCache';
import { loadConfig } from './infrastructure/config/config';

let httpServer: Server | undefined;

/**
 * Room for the answers in flight before the platform restarts us.
 *
 * Derived from the request ceiling, not chosen: past `REQUEST_TIMEOUT_MS`
 * there is nothing legitimate left to wait for. A shorter deadline — it was a
 * flat 5 s — cut requests that were still inside their own budget, which is
 * exactly what closing the server instead of exiting outright was meant to
 * avoid. Render allows ~30 s after SIGTERM, so this fits with margin.
 */
const SHUTDOWN_DEADLINE_MS = REQUEST_TIMEOUT_MS + 1_000;

/**
 * Stop serving and let Render start a fresh process. `server.close` waits for
 * the open connections, hence the deadline: a half-dead process that never
 * exits is worse than a hard cut.
 */
function terminate(code: number): void {
  if (!httpServer) {
    process.exit(code);
  }
  const forced = setTimeout(() => process.exit(code), SHUTDOWN_DEADLINE_MS);
  forced.unref();
  httpServer.close((err?: Error) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[server] Error during shutdown:', err);
    }
    process.exit(code);
  });
}

function wireProcessGuards() {
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[process] Unhandled promise rejection:', reason);
    // Logged and NOT fatal, deliberately. Almost every promise here wraps a
    // call to a third-party provider that fails routinely (AEMET 503, Cruz
    // Roja 403); turning one escaped rejection into a process death would
    // trade a log line for a Render free cold start, which the user does
    // notice. An unhandled rejection is still a bug: the fix is the missing
    // catch on that background promise, not killing the server.
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[process] Uncaught exception:', err);
    // Here we do leave: after a synchronous throw nobody caught, the state of
    // the process can no longer be trusted.
    terminate(1);
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
  // So the fatal path can close it instead of cutting the answers in flight.
  httpServer = server;

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}, shutting down...`);
    terminate(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Fatal error during bootstrap:', err);
  process.exit(1);
});
