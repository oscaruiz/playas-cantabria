/**
 * The native Android build cannot run here (no JDK in CI), so the escaping of
 * `<string>` resources has to be pinned somewhere. This is that somewhere: an
 * unescaped apostrophe in a region name does not degrade anything, it FAILS
 * the AAPT2 compilation, and it would only show up when someone tried to
 * release the app of a region whose name carries one.
 */

// require, not import: the script lives outside `src/` and is plain .mjs, so
// TypeScript cannot resolve it as a module. The empty export below is what
// keeps this file a module under --isolatedModules.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { escapeAndroidString } = require('../../scripts/android-strings.mjs');

export {};

describe('escapeAndroidString', () => {
  it('escapes the apostrophe, which is what breaks the build', () => {
    expect(escapeAndroidString("Platges de L'Hospitalet")).toBe("Platges de L\\'Hospitalet");
  });

  it('escapes quotes and backslash', () => {
    expect(escapeAndroidString('Playas "del Norte"')).toBe('Playas \\"del Norte\\"');
    expect(escapeAndroidString('a\\b')).toBe('a\\\\b');
  });

  it('does not double the backslashes that the escaping itself introduces', () => {
    // If the backslash rule ran last it would turn \' into \\', which Android
    // reads as a literal backslash followed by an unescaped apostrophe.
    expect(escapeAndroidString("L'A")).toBe("L\\'A");
  });

  it('still escapes XML entities', () => {
    expect(escapeAndroidString('Playas & Rías')).toBe('Playas &amp; Rías');
    expect(escapeAndroidString('a<b>c')).toBe('a&lt;b&gt;c');
  });

  it('leaves an ordinary name intact', () => {
    expect(escapeAndroidString('Playas de Cantabria')).toBe('Playas de Cantabria');
  });
});
