import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { WebcamCard } from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/WebcamCard';
import type { BeachWebcam } from '../../../../../Dev/playas-cantabria/frontend/src/services/api';

const renderCard = (webcam?: BeachWebcam | null) =>
  render(
    <LanguageProvider>
      <WebcamCard webcam={webcam} />
    </LanguageProvider>
  );

describe('WebcamCard', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('app_idioma', 'es');
  });

  it('no renderiza nada sin webcam', () => {
    const { container } = renderCard(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('no renderiza nada si la webcam está desactivada', () => {
    const { container } = renderCard({ url: 'https://x.test', cobertura: 'exacta', estado: 'desactivada' });
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra un enlace externo seguro con la etiqueta de cobertura exacta', () => {
    renderCard({ url: 'https://ejemplo.test/cam', cobertura: 'exacta' });
    const link = screen.getByRole('link', { name: /abrir webcam/i });
    expect(link).toHaveAttribute('href', 'https://ejemplo.test/cam');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Webcam en directo')).toBeInTheDocument();
  });

  it('usa la etiqueta panorámica para cobertura compartida', () => {
    renderCard({ url: 'https://youtube.test/watch', cobertura: 'compartida' });
    expect(screen.getByText('Vista panorámica de la zona')).toBeInTheDocument();
  });
});
