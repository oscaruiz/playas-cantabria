import React from 'react';
import { IonIcon } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import { rutaMunicipio } from '../../seo/landings';
import { getActiveAttrs } from '../../utils/beachHelpers';
import { useIdioma } from '../../i18n/IdiomaContext';
import { ClaveTexto } from '../../i18n/es';
import { DataStatus } from '../../features/provenance/SourceAndFreshness';
import { traducirTextoApi } from '../../i18n/apiText';

/** Static editorial data: dimensions, sand, access, parking, bus, hospital. */
export const BeachInfoSection: React.FC<{ datos: PlayaDetalleData }> = ({ datos }) => {
  const { t, idioma } = useIdioma();
  const history = useHistory();
  const hasAny = datos.longitud || datos.anchura || datos.tipoPlaya || datos.arena
    || (datos.acceso && datos.acceso.length > 0) || datos.parkingDescripcion || datos.bus || datos.hospitalDistancia != null;
  if (!hasAny) return null;

  return (
    <section className="detail-section beach-info-section">
      <h3 className="section-kicker">{t('detalle.infoPlaya')}</h3>
      <div className="beach-info-grid">
        {/* The reverse path municipality ← beach: the sibling beaches are
            one tap away from any detail page. */}
        <div className="beach-info-row">
          <span className="beach-info-label">{t('detalle.municipio')}</span>
          <button
            className="beach-info-value ld-enlace-municipio"
            onClick={() => history.push(rutaMunicipio(datos.municipio))}
            aria-label={t('municipio.verPlayas', { municipio: datos.municipio })}
          >
            {datos.municipio} &#8250;
          </button>
        </div>
        {(datos.longitud || datos.anchura) && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.dimensiones')}</span>
            <span className="beach-info-value">
              {datos.longitud ? `${datos.longitud} m` : '\u2014'}
              {' \u00D7 '}
              {datos.anchura ? `${datos.anchura} m` : '\u2014'}
            </span>
          </div>
        )}
        {datos.tipoPlaya && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.tipo')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.tipoPlaya, idioma)}</span>
          </div>
        )}
        {datos.arena && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.arena')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.arena, idioma)}</span>
          </div>
        )}
        {datos.acceso && datos.acceso.length > 0 && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.acceso')}</span>
            <span className="beach-info-value">
              {datos.acceso.map((a) => traducirTextoApi(a, idioma)).join(' \u00B7 ')}
            </span>
          </div>
        )}
        {datos.parkingDescripcion && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.parking')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.parkingDescripcion, idioma)}</span>
          </div>
        )}
        {datos.bus && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.bus')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.bus, idioma)}</span>
          </div>
        )}
        {datos.hospitalDistancia != null && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.hospital')}</span>
            <span className="beach-info-value">{t('comun.aKm', { km: datos.hospitalDistancia })}</span>
          </div>
        )}
      </div>
      <DataStatus clave="datos.estatico" />
    </section>
  );
};

/** Services and features, as icon chips. */
export const BeachAttributesSection: React.FC<{ atributos: PlayaDetalleData['atributos'] }> = ({ atributos }) => {
  const { t } = useIdioma();
  const attrs = getActiveAttrs(atributos);
  if (attrs.length === 0) return null;

  return (
    <section className="detail-section attr-section">
      <h3 className="section-kicker">{t('detalle.servicios')}</h3>
      <div className="attr-grid">
        {attrs.map((a) => {
          const label = t(`attr.${a.key}` as ClaveTexto);
          return (
            <span key={a.key} className="attr-item">
              <IonIcon icon={a.icon} aria-hidden="true" /> {label}
            </span>
          );
        })}
      </div>
      <DataStatus clave="datos.estatico" />
    </section>
  );
};
