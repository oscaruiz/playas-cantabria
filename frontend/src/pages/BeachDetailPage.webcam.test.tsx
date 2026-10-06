import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../shared/i18n/LanguageContext';
import { WebcamCard } from './beach-detail/WebcamCard';
import type { BeachWebcam } from '../services/api';

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

  it('renders nothing without a webcam', () => {
    const { container } = renderCard(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing if the webcam is disabled', () => {
    const { container } = renderCard({ url: 'https://x.test', cobertura: 'exacta', estado: 'desactivada' });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a safe external link with the exact-coverage label', () => {
    renderCard({ url: 'https://ejemplo.test/cam', cobertura: 'exacta' });
    const link = screen.getByRole('link', { name: /abrir webcam/i });
    expect(link).toHaveAttribute('href', 'https://ejemplo.test/cam');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Webcam en directo')).toBeInTheDocument();
  });

  it('uses the panoramic label for shared coverage', () => {
    renderCard({ url: 'https://youtube.test/watch', cobertura: 'compartida' });
    expect(screen.getByText('Vista panorámica de la zona')).toBeInTheDocument();
  });
});
