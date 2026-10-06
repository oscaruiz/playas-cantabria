import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { BlueFlagBadge } from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/BlueFlagBadge';

const renderBadge = (year?: number | null) =>
  render(
    <LanguageProvider>
      <BlueFlagBadge year={year} />
    </LanguageProvider>
  );

describe('BlueFlagBadge', () => {
  it('pinta la frase con el año y el enlace a ADEAC', () => {
    renderBadge(2026);
    expect(
      screen.getByText('Esta playa ha recibido la Bandera Azul 2026.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'banderaazulplayas.com' })).toHaveAttribute(
      'href',
      'https://www.banderaazulplayas.com/banderas-azules-cantabria/'
    );
  });

  it('no renderiza nada sin concesión registrada', () => {
    expect(renderBadge(null).container).toBeEmptyDOMElement();
    expect(renderBadge(undefined).container).toBeEmptyDOMElement();
  });
});
