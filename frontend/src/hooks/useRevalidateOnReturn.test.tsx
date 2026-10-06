import React from 'react';
import { render, act } from '@testing-library/react';
import { useRevalidateOnReturn } from '../../../../../Dev/playas-cantabria/frontend/src/hooks/useRevalidateOnReturn';

function setVisibility(status: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: status,
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const Probe: React.FC<{ onReturn: () => void }> = ({ onReturn }) => {
  useRevalidateOnReturn(onReturn);
  return null;
};

afterEach(() => setVisibility('visible'));

describe('useRevalidarAlVolver', () => {
  it('revalida al volver a la pestaña, no al dejarla', () => {
    const revalidate = jest.fn();
    render(<Probe onReturn={revalidate} />);

    setVisibility('hidden');
    expect(revalidate).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('llama a la ÚLTIMA función recibida, sin resuscribirse en cada render', () => {
    const old = jest.fn();
    const newValue = jest.fn();
    const { rerender } = render(<Probe onReturn={old} />);
    rerender(<Probe onReturn={newValue} />);

    setVisibility('visible');

    expect(old).not.toHaveBeenCalled();
    expect(newValue).toHaveBeenCalledTimes(1);
  });

  it('deja de escuchar al desmontar', () => {
    const revalidate = jest.fn();
    const { unmount } = render(<Probe onReturn={revalidate} />);
    unmount();

    setVisibility('visible');
    expect(revalidate).not.toHaveBeenCalled();
  });
});
