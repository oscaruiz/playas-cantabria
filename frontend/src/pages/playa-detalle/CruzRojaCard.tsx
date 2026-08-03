import React, { useState } from 'react';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import { estadoBandera, operadorVigilancia } from '../../utils/beachHelpers';
import { AttributionNote, FreshnessLabel } from '../../features/provenance/SourceAndFreshness';
import InfoDatos from '../../features/provenance/InfoDatos';
import { normalizarInstante } from '../../features/provenance/procedencia';
import { useIdioma, TraducirFn } from '../../shared/i18n/IdiomaContext';
import { traducirTextoApi, traducirOperador } from '../../shared/i18n/apiText';

function cruzRojaField(value: string | undefined, t: TraducirFn): string {
  if (!value || value.trim() === '' || value === 'N/A') return t('comun.noDisponible');
  return value;
}

/** Collapsible card with the lifeguard flag, coverage dates and schedule. */
const CruzRojaCard: React.FC<{
  cruzRoja?: PlayaDetalleData['cruzRoja'];
  /** Beach whose operator names the card; absent = the legacy Cruz Roja one. */
  playa?: Pick<PlayaDetalleData, 'fuenteBanderas'>;
}> = ({ cruzRoja, playa }) => {
  const { t, idioma } = useIdioma();
  const operador = operadorVigilancia(playa);
  const estado = estadoBandera(cruzRoja);
  const hasData = estado === 'color';
  // It can also be expanded outside of hours to see coverage/schedule.
  const expandable = estado !== 'sinDatos';
  const [expanded, setExpanded] = useState(hasData);

  // No operator watches this beach: there is no flag service to report, and an
  // empty card would read as "the data failed" instead of "there is none".
  if (!operador) return null;

  const nombreOperador = traducirOperador(operador, idioma);

  return (
    <div className="detail-disclosure">
      <div
        className={`card-header${!expandable ? ' card-header-disabled' : ''}`}
        onClick={expandable ? () => setExpanded((v) => !v) : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? 'cruzroja-content' : undefined}
        aria-label={expandable ? `${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${nombreOperador}` : undefined}
        aria-disabled={!expandable ? true : undefined}
        onKeyDown={expandable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <div>
          <div className="card-header-title">{nombreOperador}</div>
          <div className="card-header-subtitle">
            {hasData
              ? t('cruzroja.vigilanciaCobertura')
              : estado === 'fueraDeHorario'
                ? t('bandera.fueraDeHorario')
                : t('cruzroja.sinInfo', { operador: nombreOperador })}
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
          {normalizarInstante(cruzRoja?.ultimaActualizacion) != null && (
            <p className="cruzroja-actualizado">
              <FreshnessLabel instante={cruzRoja?.ultimaActualizacion} capitalizado />
            </p>
          )}
          {/* Quién publica esto, enlazado a su propio servicio. Va aquí y no
              solo en el banner porque esta tarjeta se pinta también cuando no
              hay bandera vigente: la cobertura y el horario siguen siendo
              suyos y hay que acreditarlos igual. */}
          <InfoDatos etiqueta="info.fuente" aria="info.aria.vigilancia">
            <AttributionNote fuente={operador} />
          </InfoDatos>
        </div>
      )}
    </div>
  );
};

export default CruzRojaCard;
