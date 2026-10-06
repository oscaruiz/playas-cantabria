import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage, detectInitialLanguage } from './LanguageContext';

const Probe: React.FC = () => {
  const { language, setLanguage, t, tPlural } = useLanguage();
  return (
    <div>
      <span data-testid="idioma">{language}</span>
      <span data-testid="simple">{t('nav.inicio')}</span>
      <span data-testid="interpolado">{t('comun.verDetalleDe', { nombre: 'Somo' })}</span>
      <span data-testid="plural-uno">{tPlural('lista.contador', 1)}</span>
      <span data-testid="plural-varios">{tPlural('lista.contador', 7)}</span>
      <button onClick={() => setLanguage('en')}>cambiar</button>
    </div>
  );
};

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in Spanish if saved and translates with interpolation and plurals', () => {
    localStorage.setItem('app_idioma', 'es');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId('idioma').textContent).toBe('es');
    expect(screen.getByTestId('simple').textContent).toBe('Inicio');
    expect(screen.getByTestId('interpolado').textContent).toBe('Ver detalle de Somo');
    expect(screen.getByTestId('plural-uno').textContent).toBe('1 playa');
    expect(screen.getByTestId('plural-varios').textContent).toBe('7 playas');
  });

  it('switches to English, updates document.lang and persists in localStorage', () => {
    localStorage.setItem('app_idioma', 'es');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText('cambiar'));
    expect(screen.getByTestId('simple').textContent).toBe('Home');
    expect(screen.getByTestId('plural-uno').textContent).toBe('1 beach');
    expect(screen.getByTestId('plural-varios').textContent).toBe('7 beaches');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('app_idioma')).toBe('en');
  });

  it('with no saved language starts in Spanish even if the browser is in English', () => {
    // jsdom exposes navigator.language = 'en-US'; detection must ignore it so
    // that Googlebot (en-US, no localStorage) indexes the Spanish metadata.
    expect(detectInitialLanguage()).toBe('es');
    localStorage.setItem('app_idioma', 'en');
    expect(detectInitialLanguage()).toBe('en');
  });
});
