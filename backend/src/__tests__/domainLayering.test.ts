import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DOMAIN = join(__dirname, '..', 'domain');

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('domain layering', () => {
  it('domain/ imports nothing from application/ or infrastructure/', () => {
    const offenders = tsFiles(DOMAIN).flatMap((file) =>
      // `from '…'`, side-effect `import '…'`, `import('…')` and `require('…')`.
      [...readFileSync(file, 'utf8').matchAll(/\b(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)]
        .map((m) => m[1])
        .filter((spec) => /\/(application|infrastructure)\//.test(spec))
        .map((spec) => `${file.slice(DOMAIN.length + 1)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });
});
