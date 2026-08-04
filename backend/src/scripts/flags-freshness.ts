/**
 * Fails when a region's flags.json has gone stale.
 *
 * Flags are the most safety-sensitive data served, and today their whole
 * delivery chain degrades in silence: the scraper does not overwrite when it
 * finds no hoisted flag (correct, that is how out-of-hours looks), the backend
 * serves whatever the file holds, and the interface hides a colour older than
 * eight hours. Every step is right on its own, and the result is that a scraper broken
 * for a week looks exactly like a quiet beach.
 *
 * Only complains IN SEASON: outside it there are no flags to capture and the
 * file is legitimately old, so alerting would train everyone to ignore it.
 *
 * Runs from its own workflow (`.github/workflows/flags-freshness.yml`), NOT
 * from the scraper's: a watchdog that only wakes when the watched job wakes
 * cannot report that it never woke.
 *
 *   npm run flags:freshness
 */
import fs from 'fs';
import { regionRegistry } from '../regions';
import { readFlagsFile } from '../regions/flagsFileSchema';
import { enTemporadaDePlaya } from '../infrastructure/config/config';

/**
 * Two limits, because the same age means different things at different hours.
 *
 * The scraper only runs during the surveillance window, so overnight the file
 * legitimately ages: at opening time the freshest capture is yesterday
 * evening's, some sixteen hours old. Alerting on that would cry wolf daily.
 *
 * Inside the window there is no such excuse — the cron passes through it
 * repeatedly — and the interface now hides any flag older than eight hours
 * (`MAX_EDAD_BANDERA_MS`). The alarm has to fire BEFORE that: a limit of 26 h,
 * sized for the old 24 h rule, let the app stop showing flags at eight and
 * nobody hear about it for another eighteen.
/**
 * Age at which the delivery chain is considered broken.
 *
 * It cannot be as tight as the eight hours the interface now uses to hide a
 * flag, because the scraper only runs during the surveillance window: the
 * first capture of the day lands around 13:00 Madrid, so until then the
 * freshest one is yesterday evening's, up to ~18 h old and perfectly
 * legitimate. Twenty hours is the tightest limit that cannot cry wolf every
 * morning — and it still catches a whole day lost six hours sooner than the
 * previous 26.
 *
 * Tightening it further means first closing that morning gap; while it exists,
 * a stricter alarm would fire daily and be ignored, which is worse than none.
/**
 * The same eight hours the interface uses to hide a flag
 * (`MAX_EDAD_BANDERA_MS`). One number, one meaning: if the app has stopped
 * showing a colour because it went stale, this must have said so.
 *
 * It can be this tight only because the check no longer runs at any hour. It
 * has its own workflow and fires at 14:00 and 18:00 Madrid — well into the
 * surveillance window, hours after the hoisting — when a healthy chain has
 * captured minutes ago. Running it at, say, noon would have meant tolerating
 * ~18 h (the scraper does not run overnight, so at opening the freshest
 * capture is yesterday evening's) and being blind to everything below that.
 */
const MAX_AGE_HOURS = 8;


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
