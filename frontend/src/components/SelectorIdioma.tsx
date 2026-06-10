import React from 'react';
import { useIdioma, Idioma } from '../i18n/IdiomaContext';
import './SelectorIdioma.css';

const IDIOMAS: Idioma[] = ['es', 'en'];

/**
 * Píldora ES/EN para las cabeceras. El stopPropagation es necesario:
 * las cabeceras sticky recargan la página al hacer click.
 */
const SelectorIdioma: React.FC = () => {
  const { idioma, setIdioma, t } = useIdioma();

  return (
    <div
      className="selector-idioma"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={t('selector.idioma')}
    >
      {IDIOMAS.map((i) => (
        <button
          key={i}
          className={`selector-idioma-btn${idioma === i ? ' active' : ''}`}
          onClick={() => setIdioma(i)}
          aria-pressed={idioma === i}
        >
          {i.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default SelectorIdioma;
