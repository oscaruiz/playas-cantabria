import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import BottomNavBar from './BottomNavBar';

/** Prints the current path so the tests can assert where a tab landed. */
const Probe: React.FC = () => <p data-testid="ruta">{useLocation().pathname}</p>;

function mount(route: string) {
  return renderWithProviders(
    <>
      <BottomNavBar />
      <Probe />
    </>,
    { route },
  );
}

describe('BottomNavBar', () => {
  it('lights up the tab of the section you are in', () => {
    mount('/mapa');
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('a beach counts as Playas, not as Inicio', () => {
    mount('/playas/suances/tagle');
    expect(screen.getByRole('button', { name: 'Playas' })).toHaveAttribute('aria-current', 'page');
  });

  it('from the legal pages, Inicio goes to the home page', () => {
    // Regression: the fallback of `deriveTab` was 'home', so on /acerca-de the
    // button thought you were already on the home page and its own guard
    // swallowed the click. Nothing happened when pressing it.
    mount('/acerca-de');
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });

  it('and on those pages no tab is lit: they are none of the three', () => {
    mount('/privacidad');
    for (const name of ['Inicio', 'Playas', 'Mapa']) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-current');
    }
  });

  it('when already on the home page, Inicio does not navigate again', () => {
    mount('/');
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });
});
