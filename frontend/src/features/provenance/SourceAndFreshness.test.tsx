import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import {
  FreshnessLabel,
  SourceAndFreshness,
} from './SourceAndFreshness';
import { formatAbsoluteInstant } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import ForecastHero from '../../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/ForecastHero';
import type { ForecastDayDTO, CurrentConditions } from '../../services/api';

const sevenMinAgo = () => Date.now() - 7 * 60000;

describe('FreshnessLabel', () => {
  it('shows the translated relative time inside a <time> with the absolute instant', () => {
    const ms = sevenMinAgo();
    const { container } = renderWithProviders(<FreshnessLabel instant={ms} />);
    const time = container.querySelector('time');
    if (!time) throw new Error('FreshnessLabel no renderizó un <time>');
    expect(time).toHaveTextContent('actualizado hace 7 min');
    expect(time.getAttribute('dateTime')).toBe(new Date(ms).toISOString());
    // The accessible name is the ABSOLUTE instant — what "7 min ago" cannot say.
    expect(time.getAttribute('aria-label')).toBe(formatAbsoluteInstant(ms, 'es'));
  });

  it('remains translated in English', () => {
    renderWithProviders(<FreshnessLabel instant={sevenMinAgo()} />, { language: 'en' });
    expect(screen.getByText('updated 7 min ago')).toBeInTheDocument();
  });

  it('capitalizes on request without touching the <time> semantics', () => {
    renderWithProviders(<FreshnessLabel instant={sevenMinAgo()} capitalized />);
    expect(screen.getByText('Actualizado hace 7 min')).toBeInTheDocument();
  });

  it('renders NOTHING for a missing or unparseable instant', () => {
    const { container } = renderWithProviders(
      <>
        <FreshnessLabel instant={null} />
        <FreshnessLabel instant={undefined} />
        <FreshnessLabel instant="basura" />
      </>
    );
    expect(container.querySelector('time')).toBeNull();
    expect(container).toHaveTextContent('');
  });
});

describe('SourceAndFreshness', () => {
  it('shows source alone when there is no timestamp — no misleading time text', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'prevision', source: 'Open-Meteo', instantMs: null }}
      />
    );
    expect(container.querySelector('.provenance-line')).toHaveTextContent(
      'Datos meteorológicos: Open-Meteo'
    );
    expect(container.querySelector('time')).toBeNull();
  });

  it('credits the source with a link to its own terms', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'prevision', source: 'Open-Meteo', instantMs: null }}
      />
    );
    const link = container.querySelector('a.provenance-link');
    expect(link).toHaveTextContent('Open-Meteo');
    expect(link).toHaveAttribute('href', 'https://open-meteo.com');
  });

  it('names an unknown source without inventing a link for it', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'prevision', source: 'Meteovecino', instantMs: null }}
      />
    );
    expect(container.querySelector('.provenance-line')).toHaveTextContent(
      'Datos meteorológicos: Meteovecino'
    );
    expect(container.querySelector('a')).toBeNull();
  });

  it('joins source and freshness for a live observation', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'directo', source: 'OpenWeather', instantMs: sevenMinAgo() }}
        sourceKey="datos.enDirectoFuente"
      />
    );
    expect(container.querySelector('.provenance-line')).toHaveTextContent(
      'Observación en directo de OpenWeather'
    );
    expect(container.querySelector('time')).not.toBeNull();
  });

  it('renders nothing when there is neither source nor instant', () => {
    const { container } = renderWithProviders(
      <>
        <SourceAndFreshness provenance={null} />
        <SourceAndFreshness
          provenance={{ kind: 'directo', source: null, instantMs: null }}
        />
      </>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ForecastHero wiring', () => {
  const DAY: ForecastDayDTO = {
    fecha: '2026-08-02',
    manana: { cielo: null, iconoCielo: null, viento: null, oleaje: null },
    tarde: { cielo: null, iconoCielo: null, viento: null, oleaje: null },
    temperaturaMaxima: null,
    sensacionTermica: null,
    temperaturaAgua: null,
    indiceUV: null,
    nivelUV: null,
    aviso: null,
  };
  const NOW_ISO: CurrentConditions = {
    cielo: 'Despejado',
    icono: 1,
    temperatura: 24,
    precipitacionMm: null,
    fuente: 'OpenWeather',
    timestamp: new Date(sevenMinAgo()).toISOString(),
  };

  it('the live headline credits its observer and capture time', () => {
    const { container } = renderWithProviders(
      <ForecastHero day={DAY} currentConditions={NOW_ISO} />
    );
    expect(container.querySelector('.provenance-line')).toHaveTextContent(
      'Observación en directo de OpenWeather'
    );
    expect(container.querySelector('time')).not.toBeNull();
  });

  it('keeps the freshness visible and the licence wording out of the way', () => {
    const { container } = renderWithProviders(
      <ForecastHero day={DAY} currentConditions={NOW_ISO} />
    );
    // La frescura no es letra pequeña: es el dato. La nota de licencia del
    // observador viaja con el resto bajo la ⓘ que cierra la columna.
    expect(container.querySelector('.provenance-line')).toHaveTextContent(
      'actualizado hace 7 min'
    );
    expect(container.querySelector('.provenance-attribution')).toBeNull();
  });

  it('without an observation there is no provenance line at all', () => {
    const { container } = renderWithProviders(<ForecastHero day={DAY} />);
    expect(container.querySelector('.provenance-line')).toBeNull();
  });
});
