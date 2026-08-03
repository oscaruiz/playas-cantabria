/**
 * Browser side of the install prompt.
 *
 * Chrome fires `beforeinstallprompt` when the app meets the install criteria
 * and is NOT installed yet. Calling `preventDefault()` stops Chrome from
 * choosing the moment and hands us the event to fire from our own button —
 * which is the whole point of this module.
 *
 * The event can fire BEFORE React mounts, and it fires once per page load: a
 * listener registered from a component would simply never see it. That is why
 * `escucharInstalacion()` is called from index.tsx.
 */

import { queOfrecer, Oferta } from '../domain/queOfrecer';

/** Not in lib.dom yet: Chrome-only, still outside the standard. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evento: EventoInstalacion | null = null;
let instalada = false;
let escuchando = false;
const oyentes = new Set<() => void>();

function emitir(): void {
  oyentes.forEach((cb) => cb());
}

export function suscribirInstalacion(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/** iPadOS 13+ claims to be a Mac; the touch points give it away. */
function esIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/** Already launched as an app: standalone window (or iOS's own flag). */
function enModoApp(): boolean {
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * A primitive, on purpose: `useSyncExternalStore` re-renders whenever the
 * snapshot changes identity, and an object rebuilt on every call would loop
 * forever.
 */
export function ofertaActual(): Oferta {
  return queOfrecer({
    hayEvento: evento !== null,
    esIOS: esIOS(),
    enModoApp: enModoApp(),
    instalada,
  });
}

export function escucharInstalacion(): void {
  if (escuchando) return;
  escuchando = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalacion;
    emitir();
  });

  // Fired by the browser however the install happened — our button, Chrome's
  // own menu, or another tab. The chip must go away in all three.
  window.addEventListener('appinstalled', () => {
    evento = null;
    instalada = true;
    emitir();
  });
}

export async function lanzarPrompt(): Promise<void> {
  const actual = evento;
  if (!actual) return;
  // One prompt per event: once shown it is spent, whatever the user answers.
  // Dropping it here also hides the chip immediately, instead of leaving a
  // button that would silently do nothing on a second click. Chrome fires a
  // new event later if the app is still installable.
  evento = null;
  emitir();
  await actual.prompt();
  await actual.userChoice;
}

/** Ask the browser/OS to handle the PWA start URL as a new app launch. */
export function abrirApp(): void {
  window.open(new URL('.', document.baseURI).href, '_blank', 'noopener');
}

/** Test seam: the listeners live on `window`, the state lives here. */
export function reiniciarInstalacionParaTests(): void {
  evento = null;
  instalada = false;
  escuchando = false;
  oyentes.clear();
}
