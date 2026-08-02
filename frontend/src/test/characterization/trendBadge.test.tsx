/**
 * El chip que dice hacia dónde va la playa en las próximas horas, y por qué.
 *
 * La nota ya lleva incorporado el ajuste del pronóstico (hasta ±8 puntos que
 * suma el backend), así que sin este chip la playa subía o bajaba en el ranking
 * sin nada en pantalla que lo explicara. La causa es lo que lo hace accionable:
 * "Mejora" a secas no dice si merece la pena esperar, "Mejora · se despeja" sí.
 */

import React from 'react';
import TrendBadge from '../../components/TrendBadge';
import { renderWithProviders } from '../render';
import type { Pronostico } from '../../services/api';

const MEJORA: Pronostico = { direccion: 'mejora', delta: 6, causa: 'despeja' };

describe('TrendBadge', () => {
  it('dice la dirección y la causa', () => {
    const { container } = renderWithProviders(<TrendBadge pronostico={MEJORA} />);
    const chip = container.querySelector('.trend-badge');

    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('se despeja');
    expect(chip).toHaveClass('trend-badge--mejora');
  });

  it('traduce la causa al inglés', () => {
    const { container } = renderWithProviders(<TrendBadge pronostico={MEJORA} />, { idioma: 'en' });

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Improving');
    expect(container.querySelector('.trend-badge')).toHaveTextContent('clearing up');
  });

  it('en una lista "sin cambios" no pinta nada: es ruido en cada tarjeta', () => {
    const { container } = renderWithProviders(
      <TrendBadge pronostico={{ direccion: 'estable', delta: 0, causa: null }} />,
    );

    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('en el detalle sí lo dice: la ausencia de cambio también responde a la pregunta', () => {
    const { container } = renderWithProviders(
      <TrendBadge pronostico={{ direccion: 'estable', delta: 0, causa: null }} size="lg" />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Sin cambios');
  });

  it('los puntos solo salen en el detalle', () => {
    const { container: lista } = renderWithProviders(<TrendBadge pronostico={MEJORA} />);
    const { container: detalle } = renderWithProviders(<TrendBadge pronostico={MEJORA} size="lg" />);

    expect(lista.querySelector('.trend-badge-delta')).toBeNull();
    expect(detalle.querySelector('.trend-badge-delta')).toHaveTextContent('+6 puntos');
  });

  it('se calla los puntos cuando contradicen la dirección', () => {
    // Lluvia prevista sobre un cielo que se abre: la lluvia manda en la
    // dirección (puntúa por los topes, no por el delta) y el delta sigue siendo
    // positivo. Enseñar "+4" junto a "Empeora" se leería como un error.
    const { container } = renderWithProviders(
      <TrendBadge
        pronostico={{ direccion: 'empeora', delta: 4, causa: 'lluvia_prevista' }}
        size="lg"
      />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('lluvia prevista');
    expect(container.querySelector('.trend-badge-delta')).toBeNull();
  });

  it('sin pronóstico no hay chip (backend antiguo o fuera de franja)', () => {
    const { container } = renderWithProviders(<TrendBadge pronostico={null} />);

    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('un backend que no manda la causa sigue diciendo la dirección', () => {
    const { container } = renderWithProviders(
      <TrendBadge pronostico={{ direccion: 'empeora', delta: -5 }} />,
    );

    expect(container.querySelector('.trend-badge')).toHaveTextContent('Está empeorando');
  });

  it('lo lee un lector de pantalla como una frase, no como palabras sueltas', () => {
    const { container } = renderWithProviders(<TrendBadge pronostico={MEJORA} />);

    expect(container.querySelector('.trend-badge')).toHaveAttribute(
      'aria-label',
      'Próximas 4 horas: Está mejorando, se despeja',
    );
  });
});
