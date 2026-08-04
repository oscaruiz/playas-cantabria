import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import BottomNavBar from './BottomNavBar';

/** Prints the current path so the tests can assert where a tab landed. */
const Sonda: React.FC = () => <p data-testid="ruta">{useLocation().pathname}</p>;

function montar(route: string) {
  return renderWithProviders(
    <>
      <BottomNavBar />
      <Sonda />
    </>,
    { route },
  );
}

describe('BottomNavBar', () => {
  it('enciende la pestaña de la sección en la que se está', () => {
    montar('/mapa');
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('una playa cuenta como Playas, no como Inicio', () => {
    montar('/playas/suances/tagle');
    expect(screen.getByRole('button', { name: 'Playas' })).toHaveAttribute('aria-current', 'page');
  });

  it('desde las páginas legales, Inicio lleva a la portada', () => {
    // Regresión: el respaldo de `deriveTab` era 'home', así que en /acerca-de
    // el botón creía que ya estabas en la portada y su propio guardia se
    // tragaba el clic. No pasaba nada al pulsarlo.
    montar('/acerca-de');
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });

  it('y en esas páginas no hay pestaña encendida: no son ninguna de las tres', () => {
    montar('/privacidad');
    for (const nombre of ['Inicio', 'Playas', 'Mapa']) {
      expect(screen.getByRole('button', { name: nombre })).not.toHaveAttribute('aria-current');
    }
  });

  it('estando ya en la portada, Inicio no vuelve a navegar', () => {
    montar('/');
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });
});
