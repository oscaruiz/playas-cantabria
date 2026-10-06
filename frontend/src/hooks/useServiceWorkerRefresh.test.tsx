import React from 'react';
import { render, act } from '@testing-library/react';
import {
  useServiceWorkerRefresh,
  API_UPDATED_MESSAGE,
  FreshResponse,
} from './useServiceWorkerRefresh';

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

describe('useServiceWorkerRefresh', () => {
  it('delivers url and data of the response that arrived late', () => {
    const onArrive = jest.fn();
    render(<Probe onArrive={onArrive} />);

    emit(FRESH);

    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith({ url: FRESH.url, datos: FRESH.datos });
  });

  it('ignores other messages and incomplete ones', () => {
    const onArrive = jest.fn();
    render(<Probe onArrive={onArrive} />);

    emit({ type: 'SKIP_WAITING' });
    emit(undefined);
    // Without a body there is nothing to paint, and asking for it would be the loop this avoids.
    emit({ type: API_UPDATED_MESSAGE, url: FRESH.url });
    emit({ type: API_UPDATED_MESSAGE, datos: {} });

    expect(onArrive).not.toHaveBeenCalled();
  });

  it('calls the LAST function received, without resubscribing on every render', () => {
    const old = jest.fn();
    const newValue = jest.fn();
    const { rerender } = render(<Probe onArrive={old} />);
    rerender(<Probe onArrive={newValue} />);

    emit(FRESH);

    expect(old).not.toHaveBeenCalled();
    expect(newValue).toHaveBeenCalledTimes(1);
  });

  it('stops listening on unmount', () => {
    const onArrive = jest.fn();
    const { unmount } = render(<Probe onArrive={onArrive} />);
    unmount();

    emit(FRESH);

    expect(onArrive).not.toHaveBeenCalled();
  });
});
