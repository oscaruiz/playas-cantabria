/**
 * What the button can honestly offer. Three booleans in, one decision out: no
 * browser, no DOM, no React, so the table of cases is readable in one screen
 * and testable without a browser.
 */

export type Oferta =
  /** Chrome handed us its event: the button installs, for real. */
  | 'prompt'
  /** iOS has no such API: the button can only explain the manual steps. */
  | 'ios'
  /** The browser confirmed installation: offer to launch the app. */
  | 'open'
  /** Nothing to offer — do not render a button that cannot do anything. */
  | null;

export function queOfrecer(estado: {
  hayEvento: boolean;
  esIOS: boolean;
  enModoApp: boolean;
  instalada: boolean;
}): Oferta {
  // Already running as an installed app: offering to install it again is
  // noise, and on iOS the manual steps would be plainly wrong.
  if (estado.enModoApp) return null;
  if (estado.instalada) return 'open';
  // The event wins over the platform: an iPad with a browser that does fire
  // `beforeinstallprompt` gets the real button, not the instructions.
  if (estado.hayEvento) return 'prompt';
  if (estado.esIOS) return 'ios';
  return null;
}
