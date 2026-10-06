import React from 'react';
import { render, act } from '@testing-library/react';
import { useRevalidateOnReturn } from './useRevalidateOnReturn';

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

describe('useRevalidateOnReturn', () => {
  it('revalidates when returning to the tab, not when leaving it', () => {
    const revalidate = jest.fn();
    render(<Probe onReturn={revalidate} />);

    setVisibility('hidden');
    expect(revalidate).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('calls the LAST function received, without resubscribing on every render', () => {
    const old = jest.fn();
    const newValue = jest.fn();
    const { rerender } = render(<Probe onReturn={old} />);
    rerender(<Probe onReturn={newValue} />);

    setVisibility('visible');

    expect(old).not.toHaveBeenCalled();
    expect(newValue).toHaveBeenCalledTimes(1);
  });

  it('stops listening on unmount', () => {
    const revalidate = jest.fn();
    const { unmount } = render(<Probe onReturn={revalidate} />);
    unmount();

    setVisibility('visible');
    expect(revalidate).not.toHaveBeenCalled();
  });
});
