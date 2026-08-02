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
      readFileSync(join(__dirname, '..', '..', 'firebase.json'), 'utf8')
    ) as { hosting: Array<{ target: string; trailingSlash?: boolean }> };

    expect(config.hosting.length).toBeGreaterThan(0);
    for (const sitio of config.hosting) {
      expect({ target: sitio.target, trailingSlash: sitio.trailingSlash }).toEqual({
        target: sitio.target,
        trailingSlash: false,
      });
    }
  });
});
