/**
 * The chip that says where the beach is heading over the next hours, and why.
 *
 * The score already includes the forecast adjustment (up to ±8 points added by
 * the backend), so without this chip the beach climbed or dropped in the ranking
 * with nothing on screen to explain it. The cause is what makes it actionable:
 * a bare "Mejora" does not say whether it is worth waiting, "Mejora · se despeja"
 * does.
 */

import React from 'react';
import TrendBadge from '../../components/TrendBadge';
import { renderWithProviders } from '../render';
import type { Outlook } from '../../services/api';

const IMPROVES: Outlook = { direccion: 'mejora', delta: 6, causa: 'despeja' };

describe('TrendBadge', () => {
  it('states the direction and the cause', () => {
    const { container } = renderWithProviders(<TrendBadge outlook={IMPROVES} />);
    const chip = container.querySelector('.trend-badge');

    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('se despeja');
    expect(chip).toHaveClass('trend-badge--mejora');
  });

  it('translates the cause into English', () => {
    const { container } = renderWithProviders(<TrendBadge outlook={IMPROVES} />, { language: 'en' });

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Improving');
    expect(container.querySelector('.trend-badge')).toHaveTextContent('clearing up');
  });

  it('in a list "sin cambios" paints nothing: it is noise on every card', () => {
    const { container } = renderWithProviders(
      <TrendBadge outlook={{ direccion: 'estable', delta: 0, causa: null }} />,
    );

    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('in the detail it does say it: the absence of change also answers the question', () => {
    const { container } = renderWithProviders(
      <TrendBadge outlook={{ direccion: 'estable', delta: 0, causa: null }} size="lg" />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Sin cambios');
  });

  it('the points only appear in the detail', () => {
    const { container: list } = renderWithProviders(<TrendBadge outlook={IMPROVES} />);
    const { container: detail } = renderWithProviders(<TrendBadge outlook={IMPROVES} size="lg" />);

    expect(list.querySelector('.trend-badge-delta')).toBeNull();
    expect(detail.querySelector('.trend-badge-delta')).toHaveTextContent('+6 puntos');
  });

  it('omits the points when they contradict the direction', () => {
    // Forecast rain under a clearing sky: rain decides the direction (it scores
    // by the caps, not by the delta) and the delta is still positive. Showing
    // "+4" next to "Empeora" would read as a bug.
    const { container } = renderWithProviders(
      <TrendBadge
        outlook={{ direccion: 'empeora', delta: 4, causa: 'lluvia_prevista' }}
        size="lg"
      />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('lluvia prevista');
    expect(container.querySelector('.trend-badge-delta')).toBeNull();
  });

  it('without a forecast there is no chip (old backend or outside the range)', () => {
    const { container } = renderWithProviders(<TrendBadge outlook={null} />);

    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('a backend that sends no cause still states the direction', () => {
    const { container } = renderWithProviders(
      <TrendBadge outlook={{ direccion: 'empeora', delta: -5 }} />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Está empeorando');
  });

  it('a screen reader reads it as a sentence, not as loose words', () => {
    const { container } = renderWithProviders(<TrendBadge outlook={IMPROVES} />);

    expect(container.querySelector('.trend-badge')).toHaveAttribute(
      'aria-label',
      'Próximas 4 horas: Está mejorando, se despeja',
    );
  });
});
