import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import LegalPage from './LegalPage';

describe('legal information pages', () => {
  it('shows the required project, source and contact information', () => {
    renderWithProviders(<LegalPage kind="acerca" />);
    expect(screen.getByRole('heading', { name: 'Acerca de y condiciones' })).toBeInTheDocument();
    expect(screen.getByText(/proyecto personal, gratuito e independiente/i)).toBeInTheDocument();
    expect(screen.getByText(/La bandera física y las instrucciones/i)).toBeInTheDocument();
    // The legal pages promise this address as the way to exercise
    // rights: if it turns into a placeholder again, the promise stops being kept.
    expect(screen.getAllByText('playascantabriapp@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oscar Ruiz').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\[(NOMBRE|EMAIL)[^\]]*\]/);
    fireEvent.click(screen.getByRole('button', { name: 'Información del proyecto' }));
    // The accessible name warns that the link leaves the app: the exit icon
    // is decorative, so if it were not said here nobody using a screen reader
    // would know before pressing.
    const github = screen.getByRole('menuitem', { name: 'GitHub (se abre fuera de la app)' });
    expect(github).toHaveAttribute('href', 'https://github.com/oscaruiz/playas-cantabria');
    expect(github).toHaveAttribute('target', '_blank');
  });

  it('documents actual storage and offers the English version', () => {
    renderWithProviders(<LegalPage kind="privacidad" />, { language: 'en' });
    expect(screen.getByRole('heading', { name: 'Privacy and storage' })).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === 'P' && /uses localStorage for favourites/i.test(node.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === 'P' && /No own use of sessionStorage/i.test(node.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getByText(/Upstash server caching/i)).toBeInTheDocument();
  });
});

/**
 * Getting out.
 *
 * These pages open from the ⓘ menu on ANY screen, so the "Playas Cantabria"
 * link home was not a way back: someone reading them from a beach detail lost
 * the beach.
 */
describe('LegalPage — back', () => {
  /** Prints the current path so the test can assert where "back" landed. */
  const Probe: React.FC = () => <p data-testid="ruta">{useLocation().pathname}</p>;

  it('goes back to the previous screen, not to the home page', () => {
    renderWithProviders(
      <>
        <LegalPage kind="acerca" />
        <Probe />
      </>,
      { route: ['/playas/suances/tagle', '/acerca-de'] },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/playas/suances/tagle');
  });

  it('arriving by a direct link there is no back: it goes to the home page', () => {
    // These are indexable pages, so arriving from a search engine is real.
    // Without this case, "volver" would take the visitor out of the site.
    renderWithProviders(
      <>
        <LegalPage kind="privacidad" />
        <Probe />
      </>,
      { route: '/privacidad' },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });
});
