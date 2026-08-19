import React from 'react';
import { render, screen } from '@testing-library/react';
import { IdiomaProvider } from '../../shared/i18n/IdiomaContext';
import { BlueFlagBadge } from './BlueFlagBadge';

const renderBadge = (year?: number | null) =>
  render(
    <IdiomaProvider>
      <BlueFlagBadge year={year} />
    </IdiomaProvider>
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
