/**
 * Escaping for Android `<string>` resources.
 *
 * Two layers stack here and both matter: the file is XML, and on top of that
 * AAPT2 gives `'`, `"` and `\` its own meaning inside a string value. An
 * unescaped apostrophe is not a cosmetic problem — it fails the native build
 * with "Apostrophe not preceded by \". Region names reach these strings
 * verbatim, and half the Catalan and Valencian coast carries one (L'Escala,
 * L'Ampolla, l'Arrabassada), so this is on the path of the very use case the
 * per-region build exists for.
 *
 * Kept in its own module, free of side effects, so it can be tested: the CI
 * has no Java and cannot compile the Android project to find out.
 */
export function escapeAndroidString(value) {
  return value
    // The literal backslash goes FIRST: doing it later would double the
    // backslashes that the next two rules introduce.
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
