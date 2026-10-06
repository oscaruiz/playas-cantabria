import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../../Dev/playas-cantabria/frontend/src/test/render';
import { EstimatedValues, ComputedAt } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import { currentObservation, MAX_OBSERVATION_AGE_MS } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import ForecastHero from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/ForecastHero';
import type { ForecastDayDTO, CurrentConditions } from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';

const DAY: ForecastDayDTO = {
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

const observation = (ago: number): CurrentConditions => ({
  cielo: 'Despejado',
  icono: 1,
  temperatura: 28,
  precipitacionMm: null,
  fuente: 'OpenWeather',
  timestamp: new Date(Date.now() - ago).toISOString(),
});

describe('observacionVigente', () => {
  it('accepts a reading within the window and rejects one past it', () => {
    expect(currentObservation(observation(MAX_OBSERVATION_AGE_MS - 60_000))).toBe(true);
    expect(currentObservation(observation(MAX_OBSERVATION_AGE_MS + 60_000))).toBe(false);
  });

  it('a reading with no timestamp cannot be vouched for, so it is not current', () => {
    expect(currentObservation({ ...observation(0), timestamp: '' })).toBe(false);
    expect(currentObservation(null)).toBe(false);
  });
});

describe('ForecastHero — observación caducada', () => {
  it('uses the reading while it is recent', () => {
    const { container } = renderWithProviders(
      <ForecastHero day={DAY} currentWeather={28} currentConditions={observation(10 * 60_000)} />
    );
    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('28');
    expect(screen.getByText('Sol')).toBeInTheDocument();
  });

  it('withdraws it once it is too old: neither its sky nor its temperature is shown as now', () => {
    const old = observation(MAX_OBSERVATION_AGE_MS + 60_000);
    const { container } = renderWithProviders(
      <ForecastHero day={DAY} currentWeather={28} currentConditions={old} />
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
      <EstimatedValues fields={['sensacion', 'oleaje', 'agua']} />
    );
    expect(container.firstChild).toHaveTextContent(
      'Valores estimados a partir de otros datos: sensación térmica, oleaje, temperatura del agua.'
    );
  });

  it('says nothing when nothing was estimated', () => {
    const { container } = renderWithProviders(
      <>
        <EstimatedValues fields={[]} />
        <EstimatedValues fields={null} />
        <EstimatedValues fields={undefined} />
      </>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ComputedAt', () => {
  it('gives the absolute date and time the backend built the payload', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    const { container } = renderWithProviders(<ComputedAt generatedAt={twoMinAgo} />);
    expect(container.firstChild).toHaveTextContent('Datos calculados el');
    expect(container.querySelector('time')).not.toBeNull();
    expect(container.firstChild).not.toHaveTextContent('caché');
  });

  it('marks the answer as cached once it is older than a recomputation would be', () => {
    const fortyMinAgo = new Date(Date.now() - 40 * 60_000).toISOString();
    const { container } = renderWithProviders(<ComputedAt generatedAt={fortyMinAgo} />);
    expect(container.firstChild).toHaveTextContent('servidos desde caché');
  });

  it('renders nothing against a backend that does not send it', () => {
    const { container } = renderWithProviders(<ComputedAt generatedAt={null} />);
    expect(container.firstChild).toBeNull();
  });
});
