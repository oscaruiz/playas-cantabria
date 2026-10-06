import React from 'react';
import { useLanguage, Language } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import './LanguageSelector.css';

const LANGUAGES: Language[] = ['es', 'en'];

/**
 * ES/EN pill for the headers. The stopPropagation is necessary:
 * the sticky headers reload the page on click.
 */
const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="selector-language"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={t('selector.idioma')}
    >
      {LANGUAGES.map((i) => (
        <button
          key={i}
          className={`selector-language-btn${language === i ? ' active' : ''}`}
          onClick={() => setLanguage(i)}
          aria-pressed={language === i}
        >
          {i.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
