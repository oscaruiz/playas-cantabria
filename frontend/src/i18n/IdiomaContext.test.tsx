import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdiomaProvider, useIdioma, detectarIdiomaInicial } from './IdiomaContext';

const Sonda: React.FC = () => {
  const { idioma, setIdioma, t, tPlural } = useIdioma();
  return (
    <div>
      <span data-testid="idioma">{idioma}</span>
      <span data-testid="simple">{t('nav.inicio')}</span>
      <span data-testid="interpolado">{t('comun.verDetalleDe', { nombre: 'Somo' })}</span>
      <span data-testid="plural-uno">{tPlural('lista.contador', 1)}</span>
      <span data-testid="plural-varios">{tPlural('lista.contador', 7)}</span>
      <button onClick={() => setIdioma('en')}>cambiar</button>
    </div>
  );
};

describe('IdiomaContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('arranca en español si está guardado y traduce con interpolación y plurales', () => {
    localStorage.setItem('app_idioma', 'es');
    render(
      <IdiomaProvider>
        <Sonda />
      </IdiomaProvider>
    );
    expect(screen.getByTestId('idioma').textContent).toBe('es');
    expect(screen.getByTestId('simple').textContent).toBe('Inicio');
    expect(screen.getByTestId('interpolado').textContent).toBe('Ver detalle de Somo');
    expect(screen.getByTestId('plural-uno').textContent).toBe('1 playa');
    expect(screen.getByTestId('plural-varios').textContent).toBe('7 playas');
  });

  it('cambia a inglés, actualiza document.lang y persiste en localStorage', () => {
    localStorage.setItem('app_idioma', 'es');
    render(
      <IdiomaProvider>
        <Sonda />
      </IdiomaProvider>
    );
    fireEvent.click(screen.getByText('cambiar'));
    expect(screen.getByTestId('simple').textContent).toBe('Home');
    expect(screen.getByTestId('plural-uno').textContent).toBe('1 beach');
    expect(screen.getByTestId('plural-varios').textContent).toBe('7 beaches');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('app_idioma')).toBe('en');
  });

  it('sin idioma guardado detecta el del navegador', () => {
    // jsdom expone navigator.language = 'en-US'
    expect(detectarIdiomaInicial()).toBe('en');
    localStorage.setItem('app_idioma', 'es');
    expect(detectarIdiomaInicial()).toBe('es');
  });
});
