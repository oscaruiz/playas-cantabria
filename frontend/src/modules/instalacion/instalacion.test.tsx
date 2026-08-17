/**
 * The install chip, through the browser events that drive it. What matters is
 * that it never appears where it cannot do anything: a button that promises an
 * install and does nothing is worse than no button.
 */

import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { queOfrecer } from './domain/queOfrecer';
import {
  escucharInstalacion,
  reiniciarInstalacionParaTests,
} from './infrastructure/promptInstalacion';
import BotonInstalar from './ui/BotonInstalar';

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

function fijarUserAgent(valor: string): void {
  Object.defineProperty(window.navigator, 'userAgent', { value: valor, configurable: true });
}

/** The Chrome event, with the two members the module uses. */
function dispararBeforeInstallPrompt(): { prompt: jest.Mock } {
  const prompt = jest.fn().mockResolvedValue(undefined);
  const evento = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => {
    window.dispatchEvent(evento);
  });
  return { prompt };
}

/** Chromium's answer to "does this device already have the app?". */
function fijarAppsInstaladas(apps: unknown[] | null): void {
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
    expect(queOfrecer({ hayEvento: true, esIOS: true, enModoApp: true, instalada: true })).toBeNull();
  });

  it('prefiere el evento del navegador a las instrucciones manuales', () => {
    expect(queOfrecer({ hayEvento: true, esIOS: true, enModoApp: false, instalada: false })).toBe('prompt');
  });

  it('cae a las instrucciones solo en iOS, y a nada en el resto', () => {
    expect(queOfrecer({ hayEvento: false, esIOS: true, enModoApp: false, instalada: false })).toBe('ios');
    expect(queOfrecer({ hayEvento: false, esIOS: false, enModoApp: false, instalada: false })).toBeNull();
  });

  it('ofrece abrir cuando el navegador acaba de confirmar la instalación', () => {
    expect(queOfrecer({ hayEvento: false, esIOS: false, enModoApp: false, instalada: true })).toBe('open');
  });
});

describe('BotonInstalar', () => {
  const uaOriginal = window.navigator.userAgent;

  beforeEach(() => {
    reiniciarInstalacionParaTests();
    fijarUserAgent(UA_ANDROID);
    fijarAppsInstaladas(null);
    escucharInstalacion();
  });

  afterEach(() => {
    fijarUserAgent(uaOriginal);
    fijarAppsInstaladas(null);
  });

  it('no pinta nada mientras el navegador no ofrezca instalar', () => {
    renderWithProviders(<BotonInstalar />);
    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('aparece cuando llega el evento y lanza el prompt del navegador al pulsarlo', async () => {
    renderWithProviders(<BotonInstalar />);
    const { prompt } = dispararBeforeInstallPrompt();

    const boton = await screen.findByRole('button', { name: /instalar app/i });
    fireEvent.click(boton);

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('desaparece tras usar el evento: no se puede volver a lanzar el mismo', async () => {
    renderWithProviders(<BotonInstalar />);
    dispararBeforeInstallPrompt();

    const boton = await screen.findByRole('button', { name: /instalar app/i });
    await act(async () => {
      fireEvent.click(boton);
    });

    expect(screen.queryByRole('button', { name: /instalar app/i })).not.toBeInTheDocument();
  });

  it('se convierte en Abrir app cuando el navegador confirma la instalación', async () => {
    renderWithProviders(<BotonInstalar />);
    dispararBeforeInstallPrompt();
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
    reiniciarInstalacionParaTests();
    fijarAppsInstaladas([{ platform: 'webapp', url: 'https://x/manifest.json' }]);
    escucharInstalacion();

    renderWithProviders(<BotonInstalar />);

    expect(await screen.findByRole('button', { name: /abrir app/i })).toBeInTheDocument();
  });

  it('si el navegador dice que no la tiene, no se inventa el botón', async () => {
    reiniciarInstalacionParaTests();
    fijarAppsInstaladas([]);
    escucharInstalacion();

    renderWithProviders(<BotonInstalar />);
    // Flush the pending getInstalledRelatedApps() promise before asserting.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: /abrir app/i })).not.toBeInTheDocument();
  });

  it('en iOS, donde no hay API, despliega las instrucciones manuales', () => {
    fijarUserAgent(UA_IPHONE);
    renderWithProviders(<BotonInstalar />);

    const boton = screen.getByRole('button', { name: /instalar app/i });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);

    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Añadir a la pantalla de inicio/i)).toBeInTheDocument();
    expect(screen.getByText(/Compartir/i)).toBeInTheDocument();
  });
});
