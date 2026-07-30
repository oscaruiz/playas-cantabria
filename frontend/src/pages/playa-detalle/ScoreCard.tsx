import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { warningOutline, chevronDownOutline } from 'ionicons/icons';
import { FeaturedBeach } from '../../services/api';
import ScoreBadge from '../../components/ScoreBadge';
import { useIdioma } from '../../i18n/IdiomaContext';
import { ClaveTexto } from '../../i18n/es';
import { traducirTextoApi, razonLegible } from '../../i18n/apiText';

// Factors of the score calculation (roughly, no technical details),
// ordered by the approximate weight they carry in the grade. Each text is
// "Concept: description" and is painted as a label/value row (pattern of the
// "Información de la playa" section).
const SCORE_ROWS: ClaveTexto[] = [
  'detalle.scoreInfo.sol',
  'detalle.scoreInfo.temp',
  'detalle.scoreInfo.bandera',
  'detalle.scoreInfo.viento',
  'detalle.scoreInfo.oleaje',
  'detalle.scoreInfo.uv',
  'detalle.scoreInfo.lluvia',
  'detalle.scoreInfo.peligro',
];

/** Today's score with its reason, and a disclosure explaining how it is computed. */
const ScoreCard: React.FC<{ puntuada: FeaturedBeach }> = ({ puntuada }) => {
  const { t, idioma } = useIdioma();
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);

  return (
    <div className="pd-score-block">
      <button
        type="button"
        className="pd-score-card pd-score-card--btn"
        onClick={() => setScoreInfoOpen((o) => !o)}
        aria-expanded={scoreInfoOpen}
        aria-controls="pd-score-info"
      >
        <ScoreBadge puntuacion={puntuada.puntuacion} size="lg" />
        <div className="pd-score-text">
          <p className="pd-score-label">
            <span>{t('detalle.puntuacion')}</span>
            <span className="pd-score-help">
              {t('detalle.comoSeCalcula')}
              <IonIcon
                icon={chevronDownOutline}
                className={`pd-score-chevron${scoreInfoOpen ? ' open' : ''}`}
                aria-hidden="true"
              />
            </span>
          </p>
          {puntuada.razonRanking && (
            <p className="pd-score-reason">
              {traducirTextoApi(razonLegible(puntuada.razonRanking), idioma)}
            </p>
          )}
          {puntuada.motivoBaja && (
            <p className="pd-score-caveat">
              <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
              {traducirTextoApi(puntuada.motivoBaja, idioma)}
            </p>
          )}
        </div>
      </button>

      {scoreInfoOpen && (
        <div id="pd-score-info" className="pd-score-info">
          <p className="pd-score-info-intro">{t('detalle.scoreInfo.intro')}</p>
          <div className="beach-info-grid">
            {SCORE_ROWS.map((k) => {
              const texto = t(k);
              const sep = texto.indexOf(':');
              const etiqueta = sep >= 0 ? texto.slice(0, sep) : texto;
              const valor = sep >= 0 ? texto.slice(sep + 1).trim() : '';
              return (
                <div className="beach-info-row" key={k}>
                  <span className="beach-info-label">{etiqueta}</span>
                  <span className="beach-info-value">{valor}</span>
                </div>
              );
            })}
          </div>
          <p className="pd-score-info-cierre">{t('detalle.scoreInfo.cierre')}</p>
        </div>
      )}
    </div>
  );
};

export default ScoreCard;
