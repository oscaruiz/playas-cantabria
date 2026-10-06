import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../shared/i18n/LanguageContext';
import TidesSection from './TidesSection';

const TIDE = { pleamar: ['09:34', '21:57'], bajamar: ['03:25', '15:45'] };

const renderSection = (reference?: { playa: string; distanciaKm: number }) =>
  render(
    <LanguageProvider>
      <TidesSection tide={TIDE} tideSource={null} isToday={false} reference={reference} />
    </LanguageProvider>
  );

describe('TidesSection — reference tide', () => {
  it('without a reference: paints the hours with no borrowed-data notice', () => {
    renderSection();
    expect(screen.getByText('09:34')).toBeInTheDocument();
    expect(screen.getByText('21:57')).toBeInTheDocument();
    expect(screen.queryByText(/no tiene tabla de mareas propia/)).not.toBeInTheDocument();
  });

  it('with a reference: paints the notice with the beach and the distance, besides the hours', () => {
    renderSection({ playa: 'Somo', distanciaKm: 4.2 });
    expect(
      screen.getByText('Esta playa no tiene tabla de mareas propia. Se muestra la de Somo, a 4.2 km.')
    ).toBeInTheDocument();
    expect(screen.getByText('09:34')).toBeInTheDocument();
  });

  it('rounds the distance to one decimal', () => {
    renderSection({ playa: 'Langre', distanciaKm: 3.14159 });
    expect(screen.getByText(/a 3\.1 km\./)).toBeInTheDocument();
  });
});
