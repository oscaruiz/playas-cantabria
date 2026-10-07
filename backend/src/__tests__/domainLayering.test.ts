import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DOMAIN = join(__dirname, '..', 'domain');
const CONTRACT = join(__dirname, '..', 'contract');
// Statement-anchored so prose in comments ("… from "x"") does not match:
// `import/export … from '…'`, side-effect `import '…'`, `import('…')`, `require('…')`.
const IMPORT =
  /^\s*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/gm;
const specifiers = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3]);

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('domain layering', () => {
  it('domain/ imports nothing from application/ or infrastructure/', () => {
    const offenders = tsFiles(DOMAIN).flatMap((file) =>
      specifiers(file)
        .filter((spec) => /\/(application|infrastructure)\//.test(spec))
        .map((spec) => `${file.slice(DOMAIN.length + 1)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  // The contract is copied verbatim into the frontend, so it must compile
  // there too: no imports at all.
  it('contract/ imports nothing', () => {
    const offenders = tsFiles(CONTRACT).flatMap((file) =>
      specifiers(file).map((spec) => `${file.slice(CONTRACT.length + 1)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });
});
