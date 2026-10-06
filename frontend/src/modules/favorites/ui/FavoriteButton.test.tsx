import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import FavoriteButton from './FavoriteButton';
import { reloadFavorites } from '../application/useFavorites';

const KEY = 'playas:favoritas';

beforeEach(() => {
  localStorage.clear();
  reloadFavorites();
});

describe('FavoriteButton', () => {
  it('marks and unmarks, persisting to localStorage', () => {
    renderWithProviders(<FavoriteButton code="3908503" name="La Concha" />);

    const btn = screen.getByRole('button', { name: 'Guardar La Concha en favoritas' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(
      screen.getByRole('button', { name: 'Quitar La Concha de favoritas' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
      version: 1,
      beachCodes: ['3908503'],
    });

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem(KEY) as string).beachCodes).toEqual([]);
  });

  it('the mark survives a remount that rereads the storage', () => {
    const first = renderWithProviders(<FavoriteButton code="X" name="X" />);
    fireEvent.click(screen.getByRole('button'));
    first.unmount();

    reloadFavorites(); // fresh session: memory dropped, storage read again
    renderWithProviders(<FavoriteButton code="X" name="X" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('with corrupt storage it starts with no favorites and can mark', () => {
    localStorage.setItem(KEY, '{corrupto');
    reloadFavorites();

    renderWithProviders(<FavoriteButton code="X" name="X" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(KEY) as string).beachCodes).toEqual(['X']);
  });

  it('neither click nor Enter/Space reach the row that navigates', () => {
    const row = jest.fn();
    renderWithProviders(
      <div role="link" tabIndex={0} onClick={row} onKeyDown={row}>
        <FavoriteButton code="X" name="X" />
      </div>
    );

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: ' ' });
    expect(row).not.toHaveBeenCalled();
  });

  it('the accessible label is translated', () => {
    renderWithProviders(<FavoriteButton code="X" name="Langre" />, { language: 'en' });
    expect(
      screen.getByRole('button', { name: 'Save Langre to favorites' })
    ).toBeInTheDocument();
  });
});
