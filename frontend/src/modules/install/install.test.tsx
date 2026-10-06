/**
 * The install chip, through the browser events that drive it. What matters is
 * that it never appears where it cannot do anything: a button that promises an
 * install and does nothing is worse than no button.
 */

import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { whatToOffer } from './domain/whatToOffer';
import {
  listenForInstall,
  resetInstallForTests,
} from './infrastructure/installPrompt';
import InstallButton from './ui/InstallButton';

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

function setUserAgent(value: string): void {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

/** The Chrome event, with the two members the module uses. */
function fireBeforeInstallPrompt(): { prompt: jest.Mock } {
  const prompt = jest.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt };
}

/** Chromium's answer to "does this device already have the app?". */
function setInstalledApps(apps: unknown[] | null): void {
  if (apps === null) {
    delete (window.navigator as { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps;
    return;
  }
  Object.defineProperty(window.navigator, 'getInstalledRelatedApps', {
    value: () => Promise.resolve(apps),
    configurable: true,
  });
}

describe('whatToOffer', () => {
  it('offers nothing inside the already installed app, neither with an event nor on iOS', () => {
    expect(whatToOffer({ hasEvent: true, isIOS: true, inAppMode: true, installed: true })).toBeNull();
  });

  it('prefers the browser event over manual instructions', () => {
    expect(whatToOffer({ hasEvent: true, isIOS: true, inAppMode: false, installed: false })).toBe('prompt');
  });

  it('falls back to instructions only on iOS, and to nothing elsewhere', () => {
    expect(whatToOffer({ hasEvent: false, isIOS: true, inAppMode: false, installed: false })).toBe('ios');
    expect(whatToOffer({ hasEvent: false, isIOS: false, inAppMode: false, installed: false })).toBeNull();
  });

  it('offers to open when the browser has just confirmed the installation', () => {
    expect(whatToOffer({ hasEvent: false, isIOS: false, inAppMode: false, installed: true })).toBe('open');
  });
});

describe('InstallButton', () => {
  const originalUa = window.navigator.userAgent;

  beforeEach(() => {
    resetInstallForTests();
    setUserAgent(UA_ANDROID);
    setInstalledApps(null);
    listenForInstall();
  });

  afterEach(() => {
    setUserAgent(originalUa);
    setInstalledApps(null);
  });

  it('paints nothing while the browser does not offer to install', () => {
    renderWithProviders(<InstallButton />);
    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('appears when the event arrives and launches the browser prompt when pressed', async () => {
    renderWithProviders(<InstallButton />);
    const { prompt } = fireBeforeInstallPrompt();

    const button = await screen.findByRole('button', { name: /instalar app/i });
    fireEvent.click(button);

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('disappears after using the event: the same one cannot be launched again', async () => {
    renderWithProviders(<InstallButton />);
    fireBeforeInstallPrompt();

    const button = await screen.findByRole('button', { name: /instalar app/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('turns into Abrir app when the browser confirms the installation', async () => {
    renderWithProviders(<InstallButton />);
    fireBeforeInstallPrompt();
    await screen.findByRole('button', { name: /instalar app/i });

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir app/i })).toBeInTheDocument();
  });

  it('on a later return it asks the browser and offers to open the already installed app', async () => {
    // Regression: `appinstalled` only fires in the tab where it was installed
    // and was not remembered, so on the next visit the chip vanished entirely
    // — Chrome withholds `beforeinstallprompt` once installed.
    resetInstallForTests();
    setInstalledApps([{ platform: 'webapp', url: 'https://x/manifest.json' }]);
    listenForInstall();

    renderWithProviders(<InstallButton />);

    expect(await screen.findByRole('button', { name: /abrir app/i })).toBeInTheDocument();
  });

  it('if the browser says it does not have it, the button is not invented', async () => {
    resetInstallForTests();
    setInstalledApps([]);
    listenForInstall();

    renderWithProviders(<InstallButton />);
    // Flush the pending getInstalledRelatedApps() promise before asserting.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: /abrir app/i })).not.toBeInTheDocument();
  });

  it('on iOS, where there is no API, it shows the manual instructions', () => {
    setUserAgent(UA_IPHONE);
    renderWithProviders(<InstallButton />);

    const button = screen.getByRole('button', { name: /instalar app/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Añadir a la pantalla de inicio/i)).toBeInTheDocument();
    expect(screen.getByText(/Compartir/i)).toBeInTheDocument();
  });
});
