import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import TidesSection from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/TidesSection';

const TIDE = { pleamar: ['09:34', '21:57'], bajamar: ['03:25', '15:45'] };

const renderSection = (reference?: { playa: string; distanciaKm: number }) =>
  render(
    <LanguageProvider>
      <TidesSection tide={TIDE} tideSource={null} isToday={false} reference={reference} />
    </LanguageProvider>
  );

describe('TidesSection — marea de referencia', () => {
  it('sin referencia: pinta las horas sin ningún aviso de préstamo', () => {
    renderSection();
    expect(screen.getByText('09:34')).toBeInTheDocument();
    expect(screen.getByText('21:57')).toBeInTheDocument();
    expect(screen.queryByText(/no tiene tabla de mareas propia/)).not.toBeInTheDocument();
  });

  it('con referencia: pinta el aviso con la playa y la distancia, además de las horas', () => {
    renderSection({ playa: 'Somo', distanciaKm: 4.2 });
    expect(
      screen.getByText('Esta playa no tiene tabla de mareas propia. Se muestra la de Somo, a 4.2 km.')
    ).toBeInTheDocument();
    expect(screen.getByText('09:34')).toBeInTheDocument();
  });

  it('redondea la distancia a un decimal', () => {
    renderSection({ playa: 'Langre', distanciaKm: 3.14159 });
    expect(screen.getByText(/a 3\.1 km\./)).toBeInTheDocument();
  });
});
