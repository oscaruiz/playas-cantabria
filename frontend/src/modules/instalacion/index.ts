/**
 * Installing the app (PWA) — public API of the module.
 *
 * It exists so the moment is ours and not Chrome's: the browser is told to
 * hold its own prompt, and the app offers it from a chip the user can find.
 *
 * `escucharInstalacion()` is wired in index.tsx, before React mounts, because
 * the browser event arrives during page load.
 */
export { escucharInstalacion } from './infrastructure/promptInstalacion';
export { useInstalacion } from './application/useInstalacion';
export { default as BotonInstalar } from './ui/BotonInstalar';
