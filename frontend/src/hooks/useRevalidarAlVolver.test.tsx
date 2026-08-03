import React from 'react';
import { render, act } from '@testing-library/react';
import { useRevalidarAlVolver } from './useRevalidarAlVolver';

function ponerVisibilidad(estado: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: estado,
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const Sonda: React.FC<{ alVolver: () => void }> = ({ alVolver }) => {
  useRevalidarAlVolver(alVolver);
  return null;
};

afterEach(() => ponerVisibilidad('visible'));

describe('useRevalidarAlVolver', () => {
  it('revalida al volver a la pestaña, no al dejarla', () => {
    const revalidar = jest.fn();
    render(<Sonda alVolver={revalidar} />);

    ponerVisibilidad('hidden');
    expect(revalidar).not.toHaveBeenCalled();

    ponerVisibilidad('visible');
    expect(revalidar).toHaveBeenCalledTimes(1);
  });

  it('llama a la ÚLTIMA función recibida, sin resuscribirse en cada render', () => {
    const vieja = jest.fn();
    const nueva = jest.fn();
    const { rerender } = render(<Sonda alVolver={vieja} />);
    rerender(<Sonda alVolver={nueva} />);

    ponerVisibilidad('visible');

    expect(vieja).not.toHaveBeenCalled();
    expect(nueva).toHaveBeenCalledTimes(1);
  });

  it('deja de escuchar al desmontar', () => {
    const revalidar = jest.fn();
    const { unmount } = render(<Sonda alVolver={revalidar} />);
    unmount();

    ponerVisibilidad('visible');
    expect(revalidar).not.toHaveBeenCalled();
  });
});
