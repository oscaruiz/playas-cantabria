/**
 * The hourly strip is the EVIDENCE for the day's window: it covers what is left
 * of the range, marks the wet hours with rain (what the window dodges) and
 * highlights the recommended stretch. Without it, "mejor momento: 15:00–19:00"
 * was a verdict with no proof in sight.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import NextHours from '../../pages/beach-detail/NextHours';
import { renderWithProviders } from '../render';
import { HourlyForecast, DayWindow } from '../../services/api';

const hour = (isoUtc: string, extra: Partial<HourlyForecast> = {}): HourlyForecast => ({
  horaIso: isoUtc,
  nubesPct: 20,
  temperaturaC: 21,
  vientoMs: 3,
  ...extra,
});

// 13:00 Madrid time on 27-Jul: the hours and the window in these cases are in the future.
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T11:00:00.000Z'));
});

afterEach(() => jest.restoreAllMocks());

const HOURS: HourlyForecast[] = [
  hour('2026-07-27T12:00:00.000Z'),
  hour('2026-07-27T13:00:00.000Z'),
  hour('2026-07-27T14:00:00.000Z'),
  hour('2026-07-27T15:00:00.000Z', { precipitacionMm: 0.6 }),
];

const TIME_WINDOW: DayWindow = {
  inicio: '2026-07-27T13:00:00.000Z',
  fin: '2026-07-27T15:00:00.000Z',
  cambio: { desde: '2026-07-27T15:00:00.000Z', causa: 'lluvia_prevista' },
  motivo: 'sin_lluvia',
  horasConsideradas: 4,
};

describe('NextHours — the strip backing the window', () => {
  it('titles the rest of the day and highlights exactly the window hours', () => {
    const { container } = renderWithProviders(
      <NextHours hours={HOURS} source="Open-Meteo" timeWindow={TIME_WINDOW} />,
      { route: '/' },
    );

    // The day is explicit and in Madrid time: "Lo que queda de hoy (jueves 21)".
    expect(screen.getByText(/^Lo que queda de hoy \([a-zá-ú]+ \d{1,2}\)$/)).toBeInTheDocument();

    const items = container.querySelectorAll('.pd-hour');
    expect(items).toHaveLength(4);
    // 15:00 and 16:00 Madrid time inside the window; 14:00 and 17:00 outside.
    expect(items[0].classList.contains('pd-hour--best')).toBe(false);
    expect(items[1].classList.contains('pd-hour--best')).toBe(true);
    expect(items[2].classList.contains('pd-hour--best')).toBe(true);
    expect(items[3].classList.contains('pd-hour--best')).toBe(false);
  });

  it('a wet hour switches the icon to rain and says so in its accessible phrase', () => {
    const { container } = renderWithProviders(
      <NextHours hours={HOURS} source="Open-Meteo" timeWindow={TIME_WINDOW} />,
      { route: '/' },
    );

    const wet = container.querySelectorAll('.pd-hour')[3];
    expect(wet.querySelector('.pd-hour-icon--rain')).not.toBeNull();
    expect(wet.getAttribute('aria-label')).toContain('lluvia prevista');
    // Dry hours keep the usual phrase.
    const dry = container.querySelectorAll('.pd-hour')[0];
    expect(dry.getAttribute('aria-label')).toContain('% de nubes');
  });

  it('when the strip hides hours, the arrow signals it and scrolls when pressed', () => {
    // jsdom does not measure: a 600 px strip in a 300 px gap is simulated.
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const scrollBy = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });

    renderWithProviders(
      <NextHours hours={HOURS} source="Open-Meteo" timeWindow={TIME_WINDOW} />,
      { route: '/' },
    );

    // At the start there is only more content ahead: a single arrow.
    expect(screen.queryByRole('button', { name: 'Ver horas anteriores' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver más horas' }));
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 240 }), // 80% of the visible gap
    );

    delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy;
  });

  it('the window inside the strip goes in detailed mode: it names its reason', () => {
    renderWithProviders(
      <NextHours hours={HOURS} source="Open-Meteo" timeWindow={TIME_WINDOW} />,
      { route: '/' },
    );

    expect(screen.getByText('Elegido por ser el tramo sin lluvia previsto')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 17:00 se espera lluvia')).toBeInTheDocument();
  });
});
