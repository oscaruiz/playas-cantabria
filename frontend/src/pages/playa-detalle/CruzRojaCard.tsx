import React, { useState } from 'react';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import { estadoBandera, capitalizar, formatearHaceTiempo } from '../../utils/beachHelpers';
import { useIdioma, TraducirFn } from '../../i18n/IdiomaContext';
import { traducirTextoApi } from '../../i18n/apiText';

function cruzRojaField(value: string | undefined, t: TraducirFn): string {
  if (!value || value.trim() === '' || value === 'N/A') return t('comun.noDisponible');
  return value;
}

/** Collapsible card with the Red Cross flag, coverage dates and schedule. */
const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const { t, idioma } = useIdioma();
  const estado = estadoBandera(cruzRoja);
  const hasData = estado === 'color';
  // It can also be expanded outside of hours to see coverage/schedule.
  const expandable = estado !== 'sinDatos';
  const [expanded, setExpanded] = useState(hasData);

  return (
    <div className="detail-disclosure">
      <div
        className={`card-header${!expandable ? ' card-header-disabled' : ''}`}
        onClick={expandable ? () => setExpanded((v) => !v) : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? 'cruzroja-content' : undefined}
        aria-label={expandable ? `${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${t('comun.cruzRoja')}` : undefined}
        aria-disabled={!expandable ? true : undefined}
        onKeyDown={expandable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <div>
          <div className="card-header-title">{t('comun.cruzRoja')}</div>
          <div className="card-header-subtitle">
            {hasData
              ? t('cruzroja.vigilanciaCobertura')
              : estado === 'fueraDeHorario'
                ? t('bandera.fueraDeHorario')
                : t('cruzroja.sinInfo')}
          </div>
        </div>
        {expandable && <span className={`card-header-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">&#9662;</span>}
      </div>

      {expanded && (
        <div className="card-body card-body-enter" id="cruzroja-content">
          <div className="info-rows">
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.banderaActual')}</span>
              <span className={`info-row-value ${!hasData ? 'muted' : ''}`}>
                {hasData
                  ? traducirTextoApi(cruzRoja!.bandera, idioma)
                  : estado === 'fueraDeHorario'
                    ? t('bandera.fueraDeHorario')
                    : t('comun.noDisponible')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaDesde')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaDesde ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaDesde, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaHasta')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaHasta ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaHasta, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.horario')}</span>
              <span className={`info-row-value ${!cruzRoja?.horario ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.horario, t)}
              </span>
            </div>
          </div>
          {cruzRoja?.ultimaActualizacion && (
            <p className="cruzroja-actualizado">
              {capitalizar(formatearHaceTiempo(cruzRoja.ultimaActualizacion, t))}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CruzRojaCard;
