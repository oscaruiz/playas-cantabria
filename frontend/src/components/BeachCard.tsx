import React from 'react';
import { IonIcon } from '@ionic/react';
import { videocamOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import { Playa, FeaturedBeach } from '../services/api';
import {
  emojiCielo,
  getActiveAttrs,
  vigilanciaDisponible,
  operadorVigilancia,
  webcamDisponible,
} from '../utils/beachHelpers';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import { ClaveTexto } from '../shared/i18n/es';
import {
  traducirTextoApi,
  razonLegible,
  traducirOperador,
  sinFragmentoDePronostico,
} from '../shared/i18n/apiText';
import ScoreBadge from './ScoreBadge';
import TrendBadge from './TrendBadge';
import { FavoriteButton } from '../modules/favorites';
import { rutaPlaya } from '../shared/seo/beachUrls';
import { rutaMunicipio } from '../shared/seo/landings';

/**
 * One beach row — THE beach row: extracted from PlayasList so the
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
  playa: Playa;
  weather?: FeaturedBeach;
  distKm?: number | null;
}> = ({ playa, weather, distKm = null }) => {
  const { t, idioma } = useIdioma();
  const skyEmoji = weather ? emojiCielo(weather.descripcionClima) : null;

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
            to={rutaPlaya(playa)}
            className="beach-card-enlace"
            aria-label={t('comun.verDetalleDe', { nombre: `${playa.nombre}, ${playa.municipio}` })}
          >
            {playa.nombre}
          </Link>
        </p>
        <p className="beach-card-municipio">
          <Link
            to={rutaMunicipio(playa.municipio)}
            className="ld-enlace-municipio"
            aria-label={t('municipio.verPlayas', { municipio: playa.municipio })}
          >
            {playa.municipio}
          </Link>
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
