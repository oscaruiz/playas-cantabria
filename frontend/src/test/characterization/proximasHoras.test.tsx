/**
 * La tira horaria es la EVIDENCIA de la ventana del día: cubre lo que queda
 * de franja, marca con lluvia las horas mojadas (lo que la ventana esquiva) y
 * resalta el tramo recomendado. Sin eso, "mejor momento: 15:00–19:00" era un
 * veredicto sin pruebas a la vista.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import ProximasHoras from '../../pages/playa-detalle/ProximasHoras';
import { renderWithProviders } from '../render';
import { PrevisionHora, VentanaDia } from '../../services/api';

const hora = (isoUtc: string, extra: Partial<PrevisionHora> = {}): PrevisionHora => ({
  horaIso: isoUtc,
  nubesPct: 20,
  temperaturaC: 21,
  vientoMs: 3,
  ...extra,
});

// 13:00 Madrid del 27-jul: las horas y la ventana de estos casos son futuras.
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T11:00:00.000Z'));
});

afterEach(() => jest.restoreAllMocks());

const HORAS: PrevisionHora[] = [
  hora('2026-07-27T12:00:00.000Z'),
  hora('2026-07-27T13:00:00.000Z'),
  hora('2026-07-27T14:00:00.000Z'),
  hora('2026-07-27T15:00:00.000Z', { precipitacionMm: 0.6 }),
];

const VENTANA: VentanaDia = {
  inicio: '2026-07-27T13:00:00.000Z',
  fin: '2026-07-27T15:00:00.000Z',
  cambio: { desde: '2026-07-27T15:00:00.000Z', causa: 'lluvia_prevista' },
  motivo: 'sin_lluvia',
  horasConsideradas: 4,
};

describe('ProximasHoras — la tira que respalda la ventana', () => {
  it('titula el resto del día y resalta exactamente las horas de la ventana', () => {
    const { container } = renderWithProviders(
      <ProximasHoras horas={HORAS} fuente="Open-Meteo" ventana={VENTANA} />,
      { route: '/' },
    );

    // El día va explícito y en hora de Madrid: "Lo que queda de hoy (jueves 21)".
    expect(screen.getByText(/^Lo que queda de hoy \([a-zá-ú]+ \d{1,2}\)$/)).toBeInTheDocument();

    const items = container.querySelectorAll('.pd-hora');
    expect(items).toHaveLength(4);
    // 15:00 y 16:00 Madrid dentro de la ventana; 14:00 y 17:00 fuera.
    expect(items[0].classList.contains('pd-hora--mejor')).toBe(false);
    expect(items[1].classList.contains('pd-hora--mejor')).toBe(true);
    expect(items[2].classList.contains('pd-hora--mejor')).toBe(true);
    expect(items[3].classList.contains('pd-hora--mejor')).toBe(false);
  });

  it('una hora mojada cambia el icono a lluvia y lo dice en su frase accesible', () => {
    const { container } = renderWithProviders(
      <ProximasHoras horas={HORAS} fuente="Open-Meteo" ventana={VENTANA} />,
      { route: '/' },
    );

    const mojada = container.querySelectorAll('.pd-hora')[3];
    expect(mojada.querySelector('.pd-hora-icono--lluvia')).not.toBeNull();
    expect(mojada.getAttribute('aria-label')).toContain('lluvia prevista');
    // Las horas secas conservan la frase de siempre.
    const seca = container.querySelectorAll('.pd-hora')[0];
    expect(seca.getAttribute('aria-label')).toContain('% de nubes');
  });

  it('cuando la tira oculta horas, la flecha lo señala y desplaza al pulsarla', () => {
    // jsdom no mide: se simula una tira de 600 px en un hueco de 300.
    jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const scrollBy = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });

    renderWithProviders(
      <ProximasHoras horas={HORAS} fuente="Open-Meteo" ventana={VENTANA} />,
      { route: '/' },
    );

    // Al inicio solo hay más contenido por delante: una única flecha.
    expect(screen.queryByRole('button', { name: 'Ver horas anteriores' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver más horas' }));
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 240 }), // el 80% del hueco visible
    );

    delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy;
  });

  it('la ventana dentro de la tira va en modo detallado: nombra su motivo', () => {
    renderWithProviders(
      <ProximasHoras horas={HORAS} fuente="Open-Meteo" ventana={VENTANA} />,
      { route: '/' },
    );

    expect(screen.getByText('Elegido por ser el tramo sin lluvia previsto')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 17:00 se espera lluvia')).toBeInTheDocument();
  });
});
