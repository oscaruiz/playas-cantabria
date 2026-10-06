import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../shared/i18n/LanguageContext';
import { BlueFlagBadge } from './BlueFlagBadge';

const renderBadge = (year?: number | null) =>
  render(
    <LanguageProvider>
      <BlueFlagBadge year={year} />
    </LanguageProvider>
  );

describe('BlueFlagBadge', () => {
  it('paints the phrase with the year and the link to ADEAC', () => {
    renderBadge(2026);
    expect(
      screen.getByText('Esta playa ha recibido la Bandera Azul 2026.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'banderaazulplayas.com' })).toHaveAttribute(
      'href',
      'https://www.banderaazulplayas.com/banderas-azules-cantabria/'
    );
  });

  it('renders nothing without a registered award', () => {
    expect(renderBadge(null).container).toBeEmptyDOMElement();
    expect(renderBadge(undefined).container).toBeEmptyDOMElement();
  });
});
