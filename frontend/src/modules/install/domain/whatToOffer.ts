/**
 * What the button can honestly offer. Three booleans in, one decision out: no
 * browser, no DOM, no React, so the table of cases is readable in one screen
 * and testable without a browser.
 */

export type Offer =
  /** Chrome handed us its event: the button installs, for real. */
  | 'prompt'
  /** iOS has no such API: the button can only explain the manual steps. */
  | 'ios'
  /** The browser confirmed installation: offer to launch the app. */
  | 'open'
  /** Nothing to offer — do not render a button that cannot do anything. */
  | null;

export function whatToOffer(status: {
  hasEvent: boolean;
  isIOS: boolean;
  inAppMode: boolean;
  installed: boolean;
}): Offer {
  // Already running as an installed app: offering to install it again is
  // noise, and on iOS the manual steps would be plainly wrong.
  if (status.inAppMode) return null;
  if (status.installed) return 'open';
  // The event wins over the platform: an iPad with a browser that does fire
  // `beforeinstallprompt` gets the real button, not the instructions.
  if (status.hasEvent) return 'prompt';
  if (status.isIOS) return 'ios';
  return null;
}
