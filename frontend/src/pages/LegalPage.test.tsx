import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import LegalPage from './LegalPage';

describe('legal information pages', () => {
  it('shows the required project, source and contact information', () => {
    renderWithProviders(<LegalPage tipo="acerca" />);
    expect(screen.getByRole('heading', { name: 'Acerca de y condiciones' })).toBeInTheDocument();
    expect(screen.getByText(/proyecto personal, gratuito e independiente/i)).toBeInTheDocument();
    expect(screen.getByText(/La bandera física y las instrucciones/i)).toBeInTheDocument();
    // Las páginas legales prometen esta dirección como vía para ejercer
    // derechos: si vuelve a ser un marcador, la promesa deja de cumplirse.
    expect(screen.getAllByText('playascantabriapp@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oscar Ruiz').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\[(NOMBRE|EMAIL)[^\]]*\]/);
    fireEvent.click(screen.getByRole('button', { name: 'Información del proyecto' }));
    // El nombre accesible avisa de que el enlace sale de la app: el icono de
    // salida es decorativo, así que si no lo dijera aquí nadie con lector lo
    // sabría antes de pulsar.
    const github = screen.getByRole('menuitem', { name: 'GitHub (se abre fuera de la app)' });
    expect(github).toHaveAttribute('href', 'https://github.com/oscaruiz/playas-cantabria');
    expect(github).toHaveAttribute('target', '_blank');
  });

  it('documents actual storage and offers the English version', () => {
    renderWithProviders(<LegalPage tipo="privacidad" />, { idioma: 'en' });
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
describe('LegalPage — volver', () => {
  /** Prints the current path so the test can assert where "back" landed. */
  const Sonda: React.FC = () => <p data-testid="ruta">{useLocation().pathname}</p>;

  it('vuelve a la pantalla anterior, no a la portada', () => {
    renderWithProviders(
      <>
        <LegalPage tipo="acerca" />
        <Sonda />
      </>,
      { route: ['/playas/suances/tagle', '/acerca-de'] },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/playas/suances/tagle');
  });

  it('llegando por un enlace directo no hay atrás: lleva a la portada', () => {
    // Son páginas indexables, así que entrar desde un buscador es real. Sin
    // este caso, "volver" sacaría al visitante del sitio.
    renderWithProviders(
      <>
        <LegalPage tipo="privacidad" />
        <Sonda />
      </>,
      { route: '/privacidad' },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('ruta')).toHaveTextContent('/');
  });
});
