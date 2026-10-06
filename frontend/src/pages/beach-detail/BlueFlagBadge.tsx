import React from 'react';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';

/**
 * Blue Flag (ADEAC) card, always shown WITH its award year. The award is
 * annual, so the year is part of the message on purpose: when the catalog
 * has not been renewed yet, "Bandera Azul 2026" in 2027 is stale but true,
 * never a lie. Hidden entirely if the beach has no award on record.
 *
 * The pennant reuses the Cruz Roja flag silhouette (same clip-path) so both
 * flags read as the same kind of object; the link goes to the ADEAC site.
 */
export const BlueFlagBadge: React.FC<{ year?: number | null }> = ({ year }) => {
  const { t } = useLanguage();
  if (year == null) return null;
  return (
    <section className="detail-section blue-flag-section">
      <div className="blue-flag-row">
        <span
          className="blue-flag-pennant"
          role="img"
          aria-label={t('banderaAzul.distintivo', { year })}
        />
        <div>
          <p className="blue-flag-phrase">{t('banderaAzul.frase', { year })}</p>
          <p className="blue-flag-more">
            {t('banderaAzul.masInfo')}{' '}
            <a
              className="blue-flag-link"
              href="https://www.banderaazulplayas.com/banderas-azules-cantabria/"
              target="_blank"
              rel="noopener noreferrer"
            >
              banderaazulplayas.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default BlueFlagBadge;
