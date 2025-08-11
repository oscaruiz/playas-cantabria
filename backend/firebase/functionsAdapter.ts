import * as functions from 'firebase-functions';
import { buildExpressApp } from '../src/express/server';
import { InMemoryCache } from '../src/infrastructure/cache/InMemoryCache';
// Importing ensures config is initialized from functions.config() in Firebase env
import { loadConfig } from '../src/infrastructure/config/config';

// Load/validate config once (will read from functions.config() in Firebase)
loadConfig();

// Build express app with shared cache
const app = buildExpressApp({ cache: new InMemoryCache() });

/**
 * HTTPS Function wrapping the Express app.
 * Adjust region if desired (e.g., 'europe-west1').
 */
export const api = functions
  // .region('europe-west1') // uncomment to pin region
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onRequest(app);
