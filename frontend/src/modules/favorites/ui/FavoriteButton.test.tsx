import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import FavoriteButton from './FavoriteButton';
import { recargarFavoritas } from '../application/useFavorites';

const CLAVE = 'playas:favoritas';

beforeEach(() => {
  localStorage.clear();
  recargarFavoritas();
});

describe('FavoriteButton', () => {
  it('marca y desmarca, persistiendo en localStorage', () => {
    renderWithProviders(<FavoriteButton codigo="3908503" nombre="La Concha" />);

    const btn = screen.getByRole('button', { name: 'Guardar La Concha en favoritas' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(
      screen.getByRole('button', { name: 'Quitar La Concha de favoritas' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(CLAVE) as string)).toEqual({
      version: 1,
      beachCodes: ['3908503'],
    });

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem(CLAVE) as string).beachCodes).toEqual([]);
  });

  it('la marca sobrevive a un remontaje que relee el almacenamiento', () => {
    const primera = renderWithProviders(<FavoriteButton codigo="X" nombre="X" />);
    fireEvent.click(screen.getByRole('button'));
    primera.unmount();

    recargarFavoritas(); // fresh session: memory dropped, storage read again
    renderWithProviders(<FavoriteButton codigo="X" nombre="X" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('con el almacenamiento corrupto arranca sin favoritas y puede marcar', () => {
    localStorage.setItem(CLAVE, '{corrupto');
    recargarFavoritas();

    renderWithProviders(<FavoriteButton codigo="X" nombre="X" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(CLAVE) as string).beachCodes).toEqual(['X']);
  });

  it('ni el click ni Enter/Espacio llegan a la fila que navega', () => {
    const fila = jest.fn();
    renderWithProviders(
      <div role="link" tabIndex={0} onClick={fila} onKeyDown={fila}>
        <FavoriteButton codigo="X" nombre="X" />
      </div>
    );

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: ' ' });
    expect(fila).not.toHaveBeenCalled();
  });

  it('la etiqueta accesible está traducida', () => {
    renderWithProviders(<FavoriteButton codigo="X" nombre="Langre" />, { idioma: 'en' });
    expect(
      screen.getByRole('button', { name: 'Save Langre to favorites' })
    ).toBeInTheDocument();
  });
});
