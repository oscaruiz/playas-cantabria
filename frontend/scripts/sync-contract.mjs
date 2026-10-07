/**
 * Copies the backend's public API contract into `src/contract/`.
 *
 * The JSON shapes the backend sends live in ONE place,
 * `backend/src/contract/`; the frontend types are aliases of this copy. CRA
 * cannot compile code outside `src/`, hence a copy rather than an import —
 * the same bridge `sync-region` builds for region data.
 *
 * The copy is COMMITTED. `--check` writes nothing and exits 1 when the copy
 * differs from the source: CI runs it, so a backend change that was not
 * synced (and type-checked here) cannot reach main.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(scriptDir, '../../backend/src/contract');
const target = path.resolve(scriptDir, '../src/contract');
const check = process.argv.includes('--check');

const HEADER =
  '// GENERATED from backend/src/contract by `npm run sync-contract`. Do not edit:\n' +
  '// change the backend file and sync.\n\n';

// Line endings are normalised: with core.autocrlf the working copies differ
// by platform while the committed content is the same.
const read = async (file) => (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');

const files = (await readdir(source)).filter((f) => f.endsWith('.ts')).sort();
const expected = new Map(
  await Promise.all(files.map(async (f) => [f, HEADER + (await read(path.join(source, f)))])),
);

if (check) {
  // Every entry counts, not just .ts: sync wipes the folder, so anything
  // extra there is something a sync would silently delete.
  const actual = (await readdir(target).catch(() => [])).sort();
  const stale = [...new Set([...files, ...actual])].filter(
    (f) => !actual.includes(f) || !expected.has(f),
  );
  for (const f of actual.filter((f) => expected.has(f))) {
    if ((await read(path.join(target, f))) !== expected.get(f)) stale.push(f);
  }
  if (stale.length > 0) {
    console.error(
      `[check-contract] src/contract is out of sync with backend/src/contract: ${stale.join(', ')}.\n` +
        'Run `npm run sync-contract` in frontend/ and fix the type errors it reveals.',
    );
    process.exit(1);
  }
  console.log(`[check-contract] ${files.length} file(s) in sync.`);
} else {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const [f, content] of expected) await writeFile(path.join(target, f), content);
  console.log(`[sync-contract] ${files.length} file(s) copied to src/contract/.`);
}
