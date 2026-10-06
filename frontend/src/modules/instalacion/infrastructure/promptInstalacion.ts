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

import { whatToOffer, Offer } from '../domain/queOfrecer';

/** Not in lib.dom yet: Chrome-only, still outside the standard. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Chromium-only too, and also outside lib.dom. */
interface RelatedApp {
  platform: string;
  url?: string;
  id?: string;
}

let event: InstallEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((cb) => cb());
}

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** iPadOS 13+ claims to be a Mac; the touch points give it away. */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/** Already launched as an app: standalone window (or iOS's own flag). */
function inAppMode(): boolean {
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * A primitive, on purpose: `useSyncExternalStore` re-renders whenever the
 * snapshot changes identity, and an object rebuilt on every call would loop
 * forever.
 */
export function currentOffer(): Offer {
  return whatToOffer({
    hasEvent: event !== null,
    isIOS: isIOS(),
    inAppMode: inAppMode(),
    installed,
  });
}

export function listenForInstall(): void {
  if (listening) return;
  listening = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    event = e as InstallEvent;
    emit();
  });

  // Fired by the browser however the install happened — our button, Chrome's
  // own menu, or another tab. The chip must go away in all three.
  window.addEventListener('appinstalled', () => {
    event = null;
    installed = true;
    emit();
  });

  void askIfInstalled();
}

/**
 * `appinstalled` only fires in the page that installed it, and it is not
 * remembered anywhere: on the NEXT visit the chip vanished entirely, because
 * Chrome withholds `beforeinstallprompt` once the app is installed. Whoever
 * had installed it was left with no way back to the app from the web.
 *
 * `getInstalledRelatedApps()` is the standard way to ask, and it needs the
 * manifest to list itself under `related_applications` — that is why the
 * generated manifest self-references.
 *
 * Chromium-only: Firefox and Safari never answer, and there the chip behaves
 * exactly as it did before. We do NOT guess from the absence of
 * `beforeinstallprompt`: that event is also missing on an uninstalled app that
 * simply does not meet the criteria, and a wrong guess sends someone to open
 * an app they never installed.
 */
async function askIfInstalled(): Promise<void> {
  const api = (navigator as { getInstalledRelatedApps?: () => Promise<RelatedApp[]> })
    .getInstalledRelatedApps;
  if (typeof api !== 'function') return;
  try {
    const apps = await api.call(navigator);
    if (apps.length > 0) {
      installed = true;
      emit();
    }
  } catch {
    // Out of scope, insecure context, or the browser refusing to answer:
    // staying silent leaves exactly the behaviour we had before.
  }
}

export async function launchPrompt(): Promise<void> {
  const current = event;
  if (!current) return;
  // One prompt per event: once shown it is spent, whatever the user answers.
  // Dropping it here also hides the chip immediately, instead of leaving a
  // button that would silently do nothing on a second click. Chrome fires a
  // new event later if the app is still installable.
  event = null;
  emit();
  await current.prompt();
  await current.userChoice;
}

/** Ask the browser/OS to handle the PWA start URL as a new app launch. */
export function openApp(): void {
  window.open(new URL('.', document.baseURI).href, '_blank', 'noopener');
}

/** Test seam: the listeners live on `window`, the state lives here. */
export function resetInstallForTests(): void {
  event = null;
  installed = false;
  listening = false;
  listeners.clear();
}
