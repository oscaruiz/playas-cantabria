import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { EstimatedValues, ComputedAt } from './SourceAndFreshness';
import { observacionVigente, MAX_EDAD_OBSERVACION_MS } from './procedencia';
import ForecastHero from '../../pages/playa-detalle/ForecastHero';
import type { DiaPrediccionDTO, TiempoActual } from '../../services/api';

const DIA: DiaPrediccionDTO = {
  fecha: '2026-08-03',
  manana: { cielo: 'Nuboso', iconoCielo: null, viento: null, oleaje: null },
  tarde: { cielo: 'Nuboso', iconoCielo: null, viento: null, oleaje: null },
  temperaturaMaxima: 21,
  sensacionTermica: null,
  temperaturaAgua: null,
  indiceUV: null,
  nivelUV: null,
  aviso: null,
};

const observacion = (hace: number): TiempoActual => ({
  cielo: 'Despejado',
  icono: 1,
  temperatura: 28,
  precipitacionMm: null,
  fuente: 'OpenWeather',
  timestamp: new Date(Date.now() - hace).toISOString(),
});

describe('observacionVigente', () => {
  it('accepts a reading within the window and rejects one past it', () => {
    expect(observacionVigente(observacion(MAX_EDAD_OBSERVACION_MS - 60_000))).toBe(true);
    expect(observacionVigente(observacion(MAX_EDAD_OBSERVACION_MS + 60_000))).toBe(false);
  });

  it('a reading with no timestamp cannot be vouched for, so it is not current', () => {
    expect(observacionVigente({ ...observacion(0), timestamp: '' })).toBe(false);
    expect(observacionVigente(null)).toBe(false);
  });
});

describe('ForecastHero — observación caducada', () => {
  it('uses the reading while it is recent', () => {
    const { container } = renderWithProviders(
      <ForecastHero dia={DIA} climaActual={28} tiempoActual={observacion(10 * 60_000)} />
    );
    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('28');
    expect(screen.getByText('Sol')).toBeInTheDocument();
  });

  it('withdraws it once it is too old: neither its sky nor its temperature is shown as now', () => {
    const vieja = observacion(MAX_EDAD_OBSERVACION_MS + 60_000);
    const { container } = renderWithProviders(
      <ForecastHero dia={DIA} climaActual={28} tiempoActual={vieja} />
    );
    // Falls back to the forecast: 21°, "Nuboso" — not the 28° "Despejado"
    // that was observed hours ago.
    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('21');
    expect(screen.queryByText('Sol')).not.toBeInTheDocument();
    // And it says so, instead of silently swapping the value.
    expect(container.querySelector('.procedencia-caducada')).toHaveTextContent(
      'Dato no disponible'
    );
  });
});

describe('EstimatedValues', () => {
  it('names the derived values so they do not read as measurements', () => {
    const { container } = renderWithProviders(
      <EstimatedValues campos={['sensacion', 'oleaje', 'agua']} />
    );
    expect(container.firstChild).toHaveTextContent(
      'Valores estimados a partir de otros datos: sensación térmica, oleaje, temperatura del agua.'
    );
  });

  it('says nothing when nothing was estimated', () => {
    const { container } = renderWithProviders(
      <>
        <EstimatedValues campos={[]} />
        <EstimatedValues campos={null} />
        <EstimatedValues campos={undefined} />
      </>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ComputedAt', () => {
  it('gives the absolute date and time the backend built the payload', () => {
    const hace2min = new Date(Date.now() - 2 * 60_000).toISOString();
    const { container } = renderWithProviders(<ComputedAt generadoEn={hace2min} />);
    expect(container.firstChild).toHaveTextContent('Datos calculados el');
    expect(container.querySelector('time')).not.toBeNull();
    expect(container.firstChild).not.toHaveTextContent('caché');
  });

  it('marks the answer as cached once it is older than a recomputation would be', () => {
    const hace40min = new Date(Date.now() - 40 * 60_000).toISOString();
    const { container } = renderWithProviders(<ComputedAt generadoEn={hace40min} />);
    expect(container.firstChild).toHaveTextContent('servidos desde caché');
  });

  it('renders nothing against a backend that does not send it', () => {
    const { container } = renderWithProviders(<ComputedAt generadoEn={null} />);
    expect(container.firstChild).toBeNull();
  });
});
