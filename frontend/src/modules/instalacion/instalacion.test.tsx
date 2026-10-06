/**
 * The install chip, through the browser events that drive it. What matters is
 * that it never appears where it cannot do anything: a button that promises an
 * install and does nothing is worse than no button.
 */

import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { whatToOffer } from './domain/queOfrecer';
import {
  listenForInstall,
  resetInstallForTests,
} from './infrastructure/promptInstalacion';
import InstallButton from './ui/BotonInstalar';

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

describe('queOfrecer', () => {
  it('no ofrece nada dentro de la app ya instalada, ni con evento ni en iOS', () => {
    expect(whatToOffer({ hasEvent: true, isIOS: true, inAppMode: true, installed: true })).toBeNull();
  });

  it('prefiere el evento del navegador a las instrucciones manuales', () => {
    expect(whatToOffer({ hasEvent: true, isIOS: true, inAppMode: false, installed: false })).toBe('prompt');
  });

  it('cae a las instrucciones solo en iOS, y a nada en el resto', () => {
    expect(whatToOffer({ hasEvent: false, isIOS: true, inAppMode: false, installed: false })).toBe('ios');
    expect(whatToOffer({ hasEvent: false, isIOS: false, inAppMode: false, installed: false })).toBeNull();
  });

  it('ofrece abrir cuando el navegador acaba de confirmar la instalación', () => {
    expect(whatToOffer({ hasEvent: false, isIOS: false, inAppMode: false, installed: true })).toBe('open');
  });
});

describe('BotonInstalar', () => {
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

  it('no pinta nada mientras el navegador no ofrezca instalar', () => {
    renderWithProviders(<InstallButton />);
    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('aparece cuando llega el evento y lanza el prompt del navegador al pulsarlo', async () => {
    renderWithProviders(<InstallButton />);
    const { prompt } = fireBeforeInstallPrompt();

    const button = await screen.findByRole('button', { name: /instalar app/i });
    fireEvent.click(button);

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('desaparece tras usar el evento: no se puede volver a lanzar el mismo', async () => {
    renderWithProviders(<InstallButton />);
    fireBeforeInstallPrompt();

    const button = await screen.findByRole('button', { name: /instalar app/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('se convierte en Abrir app cuando el navegador confirma la instalación', async () => {
    renderWithProviders(<InstallButton />);
    fireBeforeInstallPrompt();
    await screen.findByRole('button', { name: /instalar app/i });

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir app/i })).toBeInTheDocument();
  });

  it('al volver más tarde pregunta al navegador y ofrece abrir la app ya instalada', async () => {
    // Regresión: `appinstalled` solo suena en la pestaña donde se instaló y no
    // se recordaba, así que en la siguiente visita el chip desaparecía del
    // todo — Chrome retiene `beforeinstallprompt` una vez instalada.
    resetInstallForTests();
    setInstalledApps([{ platform: 'webapp', url: 'https://x/manifest.json' }]);
    listenForInstall();

    renderWithProviders(<InstallButton />);

    expect(await screen.findByRole('button', { name: /abrir app/i })).toBeInTheDocument();
  });

  it('si el navegador dice que no la tiene, no se inventa el botón', async () => {
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

  it('en iOS, donde no hay API, despliega las instrucciones manuales', () => {
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
