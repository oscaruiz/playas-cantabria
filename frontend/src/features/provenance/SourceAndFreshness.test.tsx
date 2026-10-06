import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import {
  FreshnessLabel,
  SourceAndFreshness,
} from './SourceAndFreshness';
import { formatearInstanteAbsoluto } from './procedencia';
import ForecastHero from '../../pages/playa-detalle/ForecastHero';
import type { DiaPrediccionDTO, TiempoActual } from '../../services/api';

const hace7Min = () => Date.now() - 7 * 60000;

describe('FreshnessLabel', () => {
  it('shows the translated relative time inside a <time> with the absolute instant', () => {
    const ms = hace7Min();
    const { container } = renderWithProviders(<FreshnessLabel instant={ms} />);
    const time = container.querySelector('time');
    if (!time) throw new Error('FreshnessLabel no renderizó un <time>');
    expect(time).toHaveTextContent('actualizado hace 7 min');
    expect(time.getAttribute('dateTime')).toBe(new Date(ms).toISOString());
    // The accessible name is the ABSOLUTE instant — what "7 min ago" cannot say.
    expect(time.getAttribute('aria-label')).toBe(formatearInstanteAbsoluto(ms, 'es'));
  });

  it('remains translated in English', () => {
    renderWithProviders(<FreshnessLabel instant={hace7Min()} />, { language: 'en' });
    expect(screen.getByText('updated 7 min ago')).toBeInTheDocument();
  });

  it('capitalizes on request without touching the <time> semantics', () => {
    renderWithProviders(<FreshnessLabel instant={hace7Min()} capitalized />);
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
    expect(container.querySelector('.procedencia-linea')).toHaveTextContent(
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
    const enlace = container.querySelector('a.procedencia-enlace');
    expect(enlace).toHaveTextContent('Open-Meteo');
    expect(enlace).toHaveAttribute('href', 'https://open-meteo.com');
  });

  it('names an unknown source without inventing a link for it', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'prevision', source: 'Meteovecino', instantMs: null }}
      />
    );
    expect(container.querySelector('.procedencia-linea')).toHaveTextContent(
      'Datos meteorológicos: Meteovecino'
    );
    expect(container.querySelector('a')).toBeNull();
  });

  it('joins source and freshness for a live observation', () => {
    const { container } = renderWithProviders(
      <SourceAndFreshness
        provenance={{ kind: 'directo', source: 'OpenWeather', instantMs: hace7Min() }}
        sourceKey="datos.enDirectoFuente"
      />
    );
    expect(container.querySelector('.procedencia-linea')).toHaveTextContent(
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
  const DIA: DiaPrediccionDTO = {
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
  const AHORA: TiempoActual = {
    cielo: 'Despejado',
    icono: 1,
    temperatura: 24,
    precipitacionMm: null,
    fuente: 'OpenWeather',
    timestamp: new Date(hace7Min()).toISOString(),
  };

  it('the live headline credits its observer and capture time', () => {
    const { container } = renderWithProviders(
      <ForecastHero day={DIA} currentConditions={AHORA} />
    );
    expect(container.querySelector('.procedencia-linea')).toHaveTextContent(
      'Observación en directo de OpenWeather'
    );
    expect(container.querySelector('time')).not.toBeNull();
  });

  it('keeps the freshness visible and the licence wording out of the way', () => {
    const { container } = renderWithProviders(
      <ForecastHero day={DIA} currentConditions={AHORA} />
    );
    // La frescura no es letra pequeña: es el dato. La nota de licencia del
    // observador viaja con el resto bajo la ⓘ que cierra la columna.
    expect(container.querySelector('.procedencia-linea')).toHaveTextContent(
      'actualizado hace 7 min'
    );
    expect(container.querySelector('.procedencia-atribucion')).toBeNull();
  });

  it('without an observation there is no provenance line at all', () => {
    const { container } = renderWithProviders(<ForecastHero day={DIA} />);
    expect(container.querySelector('.procedencia-linea')).toBeNull();
  });
});
