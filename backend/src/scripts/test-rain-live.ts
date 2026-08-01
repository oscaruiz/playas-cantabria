// Manual check of GetRainNowcast (live providers):
//   npx tsx src/scripts/test-rain-live.ts [lat] [lon]
// With no arguments it compares Cóbreces with Mumbai (monsoon: drizzle almost
// guaranteed), to exercise the positive path without waiting for rain in Cantabria.
import 'dotenv/config';
import { createContainer } from '../infrastructure/di';
import { resolveScriptRegion } from './scriptRegion';
import type { GetRainNowcast } from '../domain/use-cases/GetRainNowcast';

(async () => {
  // The nowcast itself is region-agnostic (it takes coordinates), but a
  // container is always bound to one region — name it rather than defaulting.
  const container = createContainer({ region: resolveScriptRegion() });
  const rainNowcast = container.get<GetRainNowcast>('getRainNowcast');

  const args = process.argv.slice(2);
  const spots: Array<[string, number, number]> =
    args.length >= 2
      ? [['custom', Number(args[0]), Number(args[1])]]
      : [
          ['Cóbreces', 43.3944, -4.2205],
          ['Mumbai (control positivo)', 19.07, 72.87],
        ];

  for (const [name, lat, lon] of spots) {
    const r = await rainNowcast.execute(lat, lon);
    console.log(`\n=== ${name} (${lat}, ${lon}) ===`);
    console.log(JSON.stringify(r, null, 1));
  }
})();
