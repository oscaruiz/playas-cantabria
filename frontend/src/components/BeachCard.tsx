import React from 'react';
import { IonIcon } from '@ionic/react';
import { videocamOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { Playa, FeaturedBeach } from '../services/api';
import {
  emojiCielo,
  getActiveAttrs,
  vigilanciaDisponible,
  operadorVigilancia,
  webcamDisponible,
} from '../utils/beachHelpers';
import { useIdioma } from '../i18n/IdiomaContext';
import { ClaveTexto } from '../i18n/es';
import {
  traducirTextoApi,
  razonLegible,
  traducirOperador,
  sinFragmentoDePronostico,
} from '../i18n/apiText';
import ScoreBadge from './ScoreBadge';
import TrendBadge from './TrendBadge';
import FavoriteButton from '../features/favorites/FavoriteButton';
import { rutaPlaya } from '../seo/beachUrls';
import { rutaMunicipio } from '../seo/landings';

/**
 * One beach row — THE beach row: extracted verbatim from PlayasList so the
 * municipality and landing pages show exactly the same card (sky+temp,
 * attributes, ranking reason, trend, score, badges, favorite star) instead
 * of a poorer copy. Conditions render only when the featured ranking
 * provided them; nothing is inferred.
 */
const BeachCard: React.FC<{
  playa: Playa;
  weather?: FeaturedBeach;
  distKm?: number | null;
}> = ({ playa, weather, distKm = null }) => {
  const history = useHistory();
  const { t, idioma } = useIdioma();
  const skyEmoji = weather ? emojiCielo(weather.descripcionClima) : null;

  return (
    <div
      className="beach-card"
      onClick={() => history.push(rutaPlaya(playa))}
      role="link"
      tabIndex={0}
      aria-label={t('comun.verDetalleDe', { nombre: `${playa.nombre}, ${playa.municipio}` })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          history.push(rutaPlaya(playa));
        }
      }}
    >
      <div className="beach-card-icon" aria-hidden="true">
        {skyEmoji && <span className="beach-card-sky">{skyEmoji}</span>}
        {weather?.temperatura != null && (
          <span className="beach-card-temp">{Math.round(weather.temperatura)}{'°'}</span>
        )}
      </div>
      <div className="beach-card-info">
        <p className="beach-card-name">{playa.nombre}</p>
        <p className="beach-card-municipio">
          {/* The card navigates to the beach; the municipality name
              navigates to the municipality — so it stops the row. */}
          <button
            className="ld-enlace-municipio"
            onClick={(e) => {
              e.stopPropagation();
              history.push(rutaMunicipio(playa.municipio));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            }}
            aria-label={t('municipio.verPlayas', { municipio: playa.municipio })}
          >
            {playa.municipio}
          </button>
          {distKm != null && (
            <span className="beach-card-dist">
              {' · '}
              {t('comun.aKm', { km: Math.round(distKm) })}
            </span>
          )}
        </p>
        {(() => {
          const attrs = getActiveAttrs(playa.atributos).slice(0, 4);
          return attrs.length > 0 ? (
            <div className="beach-card-attrs">
              {attrs.map((a) => (
                <IonIcon
                  key={a.key}
                  className="beach-attr-mini"
                  icon={a.icon}
                  title={t(`attr.${a.key}` as ClaveTexto)}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : null;
        })()}
        {weather?.razonRanking && (
          <p className="beach-card-reason">
            {traducirTextoApi(
              weather.pronostico
                ? sinFragmentoDePronostico(razonLegible(weather.razonRanking))
                : razonLegible(weather.razonRanking),
              idioma,
            )}
          </p>
        )}
        <TrendBadge pronostico={weather?.pronostico} />
      </div>
      {weather && <ScoreBadge puntuacion={weather.puntuacion} />}
      {(() => {
        const vigilada = vigilanciaDisponible(playa);
        // Named by the beach's own operator: a region without
        // Cruz Roja must not be labelled with somebody else's badge.
        const operador = operadorVigilancia(playa);
        const conWebcam = webcamDisponible(playa.webcam);
        return vigilada || conWebcam ? (
          <div className="beach-card-badges">
            {vigilada && operador && (
              <span
                className="badge-vigilada"
                aria-label={t('lista.vigiladaAria', {
                  operador: traducirOperador(operador, idioma),
                })}
              >
                <span className="badge-vigilada-dot" aria-hidden="true" />
                {traducirOperador(operador, idioma)}
              </span>
            )}
            {conWebcam && (
              <span className="badge-webcam" aria-label={t('lista.webcamAria')}>
                <IonIcon icon={videocamOutline} aria-hidden="true" />
              </span>
            )}
          </div>
        ) : null;
      })()}
      <FavoriteButton codigo={playa.codigo} nombre={playa.nombre} className="beach-card-fav" />
      <span className="beach-card-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

export default BeachCard;
