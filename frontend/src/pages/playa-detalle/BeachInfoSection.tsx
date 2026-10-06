import React from 'react';
import { IonIcon } from '@ionic/react';
import { Link } from 'react-router-dom';
import { BeachDetail } from '../../services/api';
import { municipalityPath } from '../../shared/seo/landings';
import { getActiveAttrs } from '../../utils/beachHelpers';
import { useLanguage } from '../../shared/i18n/IdiomaContext';
import { TextKey } from '../../shared/i18n/es';
import { translateApiText } from '../../shared/i18n/apiText';

/** Static editorial data: dimensions, sand, access, parking, bus, hospital. */
export const BeachInfoSection: React.FC<{ data: BeachDetail }> = ({ data }) => {
  const { t, language } = useLanguage();
  const hasAny = data.longitud || data.anchura || data.tipoPlaya || data.arena
    || (data.acceso && data.acceso.length > 0) || data.parkingDescripcion || data.bus || data.hospitalDistancia != null;
  if (!hasAny) return null;

  return (
    <section className="detail-section beach-info-section">
      <h3 className="section-kicker">{t('detalle.infoPlaya')}</h3>
      <div className="beach-info-grid">
        {/* The reverse path municipality ← beach: the sibling beaches are
            one tap away from any detail page. */}
        <div className="beach-info-row">
          <span className="beach-info-label">{t('detalle.municipio')}</span>
          <Link
            className="beach-info-value ld-enlace-municipio"
            to={municipalityPath(data.municipio)}
            aria-label={t('municipio.verPlayas', { municipio: data.municipio })}
          >
            {data.municipio} &#8250;
          </Link>
        </div>
        {(data.longitud || data.anchura) && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.dimensiones')}</span>
            <span className="beach-info-value">
              {data.longitud ? `${data.longitud} m` : '\u2014'}
              {' \u00D7 '}
              {data.anchura ? `${data.anchura} m` : '\u2014'}
            </span>
          </div>
        )}
        {data.tipoPlaya && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.tipo')}</span>
            <span className="beach-info-value">{translateApiText(data.tipoPlaya, language)}</span>
          </div>
        )}
        {data.arena && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.arena')}</span>
            <span className="beach-info-value">{translateApiText(data.arena, language)}</span>
          </div>
        )}
        {data.acceso && data.acceso.length > 0 && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.acceso')}</span>
            <span className="beach-info-value">
              {data.acceso.map((a) => translateApiText(a, language)).join(' \u00B7 ')}
            </span>
          </div>
        )}
        {data.parkingDescripcion && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.parking')}</span>
            <span className="beach-info-value">{translateApiText(data.parkingDescripcion, language)}</span>
          </div>
        )}
        {data.bus && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.bus')}</span>
            <span className="beach-info-value">{translateApiText(data.bus, language)}</span>
          </div>
        )}
        {data.hospitalDistancia != null && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.hospital')}</span>
            <span className="beach-info-value">{t('comun.aKm', { km: data.hospitalDistancia })}</span>
          </div>
        )}
      </div>
    </section>
  );
};

/** Services and features, as icon chips. */
export const BeachAttributesSection: React.FC<{ attributes: BeachDetail['atributos'] }> = ({ attributes }) => {
  const { t } = useLanguage();
  const attrs = getActiveAttrs(attributes);
  if (attrs.length === 0) return null;

  return (
    <section className="detail-section attr-section">
      <h3 className="section-kicker">{t('detalle.servicios')}</h3>
      <div className="attr-grid">
        {attrs.map((a) => {
          const label = t(`attr.${a.key}` as TextKey);
          return (
            <span key={a.key} className="attr-item">
              <IonIcon icon={a.icon} aria-hidden="true" /> {label}
            </span>
          );
        })}
      </div>
    </section>
  );
};
