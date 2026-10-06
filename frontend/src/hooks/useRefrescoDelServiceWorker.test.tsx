import React from 'react';
import { render, act } from '@testing-library/react';
import {
  useServiceWorkerRefresh,
  API_UPDATED_MESSAGE,
  FreshResponse,
} from './useRefrescoDelServiceWorker';

/**
 * jsdom has no `navigator.serviceWorker`, so the container is faked with a plain
 * EventTarget. That is exactly the surface the hook uses.
 */
const channel = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: channel,
    configurable: true,
  });
});

function emit(data: unknown) {
  act(() => {
    const event = new Event('message') as Event & { data?: unknown };
    event.data = data;
    channel.dispatchEvent(event);
  });
}

const FRESH = {
  type: API_UPDATED_MESSAGE,
  url: 'https://api.example/api/cantabria/beaches/featured',
  datos: { timestamp: 1 },
};

const Probe: React.FC<{ onArrive: (f: FreshResponse) => void }> = ({ onArrive }) => {
  useServiceWorkerRefresh(onArrive);
  return null;
};

describe('useRefrescoDelServiceWorker', () => {
  it('entrega url y datos de la respuesta que llegó tarde', () => {
    const onArrive = jest.fn();
    render(<Probe onArrive={onArrive} />);

    emit(FRESH);

    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith({ url: FRESH.url, datos: FRESH.datos });
  });

  it('ignora otros mensajes y los que vienen incompletos', () => {
    const onArrive = jest.fn();
    render(<Probe onArrive={onArrive} />);

    emit({ type: 'SKIP_WAITING' });
    emit(undefined);
    // Sin cuerpo no hay nada que pintar, y pedirlo sería el bucle que esto evita.
    emit({ type: API_UPDATED_MESSAGE, url: FRESH.url });
    emit({ type: API_UPDATED_MESSAGE, datos: {} });

    expect(onArrive).not.toHaveBeenCalled();
  });

  it('llama a la ÚLTIMA función recibida, sin resuscribirse en cada render', () => {
    const old = jest.fn();
    const newValue = jest.fn();
    const { rerender } = render(<Probe onArrive={old} />);
    rerender(<Probe onArrive={newValue} />);

    emit(FRESH);

    expect(old).not.toHaveBeenCalled();
    expect(newValue).toHaveBeenCalledTimes(1);
  });

  it('deja de escuchar al desmontar', () => {
    const onArrive = jest.fn();
    const { unmount } = render(<Probe onArrive={onArrive} />);
    unmount();

    emit(FRESH);

    expect(onArrive).not.toHaveBeenCalled();
  });
});
