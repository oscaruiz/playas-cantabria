import React from 'react';
import { render, act } from '@testing-library/react';
import {
  useRefrescoDelServiceWorker,
  MENSAJE_API_ACTUALIZADA,
  RespuestaFresca,
} from './useRefrescoDelServiceWorker';

/**
 * jsdom has no `navigator.serviceWorker`, so the container is faked with a plain
 * EventTarget. That is exactly the surface the hook uses.
 */
const canal = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: canal,
    configurable: true,
  });
});

function emitir(data: unknown) {
  act(() => {
    const evento = new Event('message') as Event & { data?: unknown };
    evento.data = data;
    canal.dispatchEvent(evento);
  });
}

const FRESCA = {
  type: MENSAJE_API_ACTUALIZADA,
  url: 'https://api.example/api/cantabria/beaches/featured',
  datos: { timestamp: 1 },
};

const Sonda: React.FC<{ alLlegar: (f: RespuestaFresca) => void }> = ({ alLlegar }) => {
  useRefrescoDelServiceWorker(alLlegar);
  return null;
};

describe('useRefrescoDelServiceWorker', () => {
  it('entrega url y datos de la respuesta que llegó tarde', () => {
    const alLlegar = jest.fn();
    render(<Sonda alLlegar={alLlegar} />);

    emitir(FRESCA);

    expect(alLlegar).toHaveBeenCalledTimes(1);
    expect(alLlegar).toHaveBeenCalledWith({ url: FRESCA.url, datos: FRESCA.datos });
  });

  it('ignora otros mensajes y los que vienen incompletos', () => {
    const alLlegar = jest.fn();
    render(<Sonda alLlegar={alLlegar} />);

    emitir({ type: 'SKIP_WAITING' });
    emitir(undefined);
    // Sin cuerpo no hay nada que pintar, y pedirlo sería el bucle que esto evita.
    emitir({ type: MENSAJE_API_ACTUALIZADA, url: FRESCA.url });
    emitir({ type: MENSAJE_API_ACTUALIZADA, datos: {} });

    expect(alLlegar).not.toHaveBeenCalled();
  });

  it('llama a la ÚLTIMA función recibida, sin resuscribirse en cada render', () => {
    const vieja = jest.fn();
    const nueva = jest.fn();
    const { rerender } = render(<Sonda alLlegar={vieja} />);
    rerender(<Sonda alLlegar={nueva} />);

    emitir(FRESCA);

    expect(vieja).not.toHaveBeenCalled();
    expect(nueva).toHaveBeenCalledTimes(1);
  });

  it('deja de escuchar al desmontar', () => {
    const alLlegar = jest.fn();
    const { unmount } = render(<Sonda alLlegar={alLlegar} />);
    unmount();

    emitir(FRESCA);

    expect(alLlegar).not.toHaveBeenCalled();
  });
});
