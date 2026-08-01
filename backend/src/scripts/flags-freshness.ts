/**
 * Fails when a region's flags.json has gone stale.
 *
 * Flags are the most safety-sensitive data served, and today their whole
 * delivery chain degrades in silence: the scraper does not overwrite when it
 * finds no hoisted flag (correct, that is how out-of-hours looks), the backend
 * serves whatever the file holds, and the interface hides a colour older than
 * 24 h. Every step is right on its own, and the result is that a scraper broken
 * for a week looks exactly like a quiet beach.
 *
 * Only complains IN SEASON: outside it there are no flags to capture and the
 * file is legitimately old, so alerting would train everyone to ignore it.
 *
 *   npm run flags:freshness
 */
import fs from 'fs';
import { regionRegistry } from '../regions';
import { readFlagsFile } from '../regions/flagsFileSchema';
import { enTemporadaDePlaya } from '../infrastructure/config/config';

/** A whole lifeguard day without a capture is already an anomaly. */
const MAX_AGE_HOURS = 26;

function main(): void {
  const ahora = new Date();
  if (!enTemporadaDePlaya(ahora)) {
    process.stdout.write('[flags-freshness] out of season: nothing to check\n');
    return;
  }

  const problemas: string[] = [];

  for (const region of regionRegistry.all()) {
    if (region.flagProviders.length === 0) continue;

    if (!fs.existsSync(region.flagsPath)) {
      problemas.push(`${region.id}: declares ${region.flagProviders.join(', ')} but has no flags.json`);
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(region.flagsPath, 'utf8')) as unknown;
    // Delegated to the shared schema so a date IN THE FUTURE is a problem too:
    // age is `now - generatedAt`, so a capture dated ahead is not fresh, it is
    // eternally fresh — the one thing this check exists to rule out.
    const { generatedAt, errors } = readFlagsFile(raw, ahora);
    if (generatedAt == null) {
      problemas.push(`${region.id}: flags.json has no usable generatedAt (${errors.join('; ')})`);
      continue;
    }

    const horas = (ahora.getTime() - generatedAt) / 3_600_000;
    if (horas > MAX_AGE_HOURS) {
      problemas.push(
        `${region.id}: flags.json is ${horas.toFixed(1)} h old (limit ${MAX_AGE_HOURS} h) — the scraper is not delivering`,
      );
    } else {
      process.stdout.write(`[flags-freshness] ${region.id}: ${horas.toFixed(1)} h old\n`);
    }
  }

  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`[flags-freshness] ${problema}`);
    throw new Error(`Stale flags in ${problemas.length} region(s)`);
  }
}

main();
