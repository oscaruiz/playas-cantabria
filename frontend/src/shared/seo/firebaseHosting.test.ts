import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Firebase serves prerendered `<ruta>/index.html` files; without
 * `trailingSlash: false` its default redirects every canonical URL to the
 * slashed variant, contradicting canonical and sitemap. Pinned here so a
 * new hosting target cannot regress it silently.
 */
describe('firebase.json hosting', () => {
  it('todos los targets fijan trailingSlash en false', () => {
    const config = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'firebase.json'), 'utf8')
    ) as { hosting: Array<{ target: string; trailingSlash?: boolean }> };

    expect(config.hosting.length).toBeGreaterThan(0);
    for (const site of config.hosting) {
      expect({ target: site.target, trailingSlash: site.trailingSlash }).toEqual({
        target: site.target,
        trailingSlash: false,
      });
    }
  });
});
