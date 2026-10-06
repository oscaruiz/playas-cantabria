import React from 'react';
import { IonIcon } from '@ionic/react';
import { videocamOutline, flag } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import { Beach, FeaturedBeach } from '../services/api';
import {
  rankedSkyEmoji,
  getActiveAttrs,
  lifeguardAvailable,
  lifeguardOperator,
  webcamAvailable,
} from '../utils/beachHelpers';
import { useLanguage } from '../shared/i18n/LanguageContext';
import { TextKey } from '../shared/i18n/es';
import {
  translateApiText,
  readableReason,
  translateOperator,
  noForecastFragment,
} from '../shared/i18n/apiText';
import ScoreBadge from './ScoreBadge';
import TrendBadge from './TrendBadge';
import { FavoriteButton } from '../modules/favorites';
import { beachPath } from '../shared/seo/beachUrls';
import { municipalityPath } from '../shared/seo/landings';

/**
 * One beach row — THE beach row: extracted from BeachList so the
 * municipality and landing pages show exactly the same card (sky+temp,
 * attributes, ranking reason, trend, score, badges, favorite star) instead
 * of a poorer copy. Conditions render only when the featured ranking
 * provided them; nothing is inferred.
 *
 * Interaction is the accessible "cover link" pattern: the beach name is a
 * REAL anchor whose ::after stretches over the whole card (copyable URL,
 * middle-click, context menu, honest role for assistive tech), while the
 * municipality link and the favorite star sit ABOVE the cover — nested
 * interactive-inside-interactive never happens.
 */
const BeachCard: React.FC<{
  beach: Beach;
  weather?: FeaturedBeach;
  distKm?: number | null;
}> = ({ beach, weather, distKm = null }) => {
  const { t, language } = useLanguage();
  const skyEmoji = weather ? rankedSkyEmoji(weather) : null;

  return (
    <div className="beach-card">
      <div className="beach-card-icon" aria-hidden="true">
        {skyEmoji && <span className="beach-card-sky">{skyEmoji}</span>}
        {weather?.temperatura != null && (
          <span className="beach-card-temp">{Math.round(weather.temperatura)}{'°'}</span>
        )}
      </div>
      <div className="beach-card-info">
        <p className="beach-card-name">
          <Link
            to={beachPath(beach)}
            className="beach-card-link"
            aria-label={t('comun.verDetalleDe', { nombre: `${beach.nombre}, ${beach.municipio}` })}
          >
            {beach.nombre}
          </Link>
        </p>
        <p className="beach-card-municipality">
          <Link
            to={municipalityPath(beach.municipio)}
            className="ld-link-municipality"
            aria-label={t('municipio.verPlayas', { municipio: beach.municipio })}
          >
            {beach.municipio}
          </Link>
          {distKm != null && (
            <span className="beach-card-dist">
              {' · '}
              {t('comun.aKm', { km: Math.round(distKm) })}
            </span>
          )}
        </p>
        {(() => {
          const attrs = getActiveAttrs(beach.atributos).slice(0, 4);
          return attrs.length > 0 ? (
            <div className="beach-card-attrs">
              {attrs.map((a) => (
                <IonIcon
                  key={a.key}
                  className="beach-attr-mini"
                  icon={a.icon}
                  title={t(`attr.${a.key}` as TextKey)}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : null;
        })()}
        {weather?.razonRanking && (
          <p className="beach-card-reason">
            {translateApiText(
              weather.pronostico
                ? noForecastFragment(readableReason(weather.razonRanking))
                : readableReason(weather.razonRanking),
              language,
            )}
          </p>
        )}
        <TrendBadge outlook={weather?.pronostico} />
      </div>
      {weather && <ScoreBadge score={weather.puntuacion} />}
      {(() => {
        const lifeguarded = lifeguardAvailable(beach);
        // Named by the beach's own operator: a region without
        // Cruz Roja must not be labelled with somebody else's badge.
        const operator = lifeguardOperator(beach);
        const withWebcam = webcamAvailable(beach.webcam);
        return lifeguarded || withWebcam ? (
          <div className="beach-card-badges">
            {lifeguarded && operator && (
              <span
                className="badge-lifeguarded"
                aria-label={t('lista.vigiladaAria', {
                  operador: translateOperator(operator, language),
                })}
              >
                <span className="badge-lifeguarded-dot" aria-hidden="true" />
                {/* The label is what the CSS drops on a narrow screen; the dot
                    and the aria-label above stay, so nothing is lost to
                    assistive tech. */}
                <span className="badge-lifeguarded-text">
                  {translateOperator(operator, language)}
                </span>
              </span>
            )}
            {withWebcam && (
              <span className="badge-webcam" aria-label={t('lista.webcamAria')}>
                <IonIcon icon={videocamOutline} aria-hidden="true" />
              </span>
            )}
            {beach.banderaAzul != null && (
              <span className="badge-flag-blue" aria-label={t('lista.banderaAzulAria')}>
                <IonIcon icon={flag} aria-hidden="true" />
              </span>
            )}
          </div>
        ) : null;
      })()}
      <FavoriteButton code={beach.codigo} name={beach.nombre} className="beach-card-fav" />
      <span className="beach-card-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

export default BeachCard;
