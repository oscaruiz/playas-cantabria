import React, { useState } from 'react';
import { BeachDetail } from '../../services/api';
import { flagStatus, lifeguardOperator } from '../../utils/beachHelpers';
import { AttributionNote, FreshnessLabel } from '../../features/provenance/SourceAndFreshness';
import DataInfo from '../../features/provenance/InfoDatos';
import { normalizeInstant } from '../../features/provenance/procedencia';
import { useLanguage, TranslateFn } from '../../shared/i18n/IdiomaContext';
import { translateApiText, translateOperator } from '../../shared/i18n/apiText';

function redCrossField(value: string | undefined, t: TranslateFn): string {
  if (!value || value.trim() === '' || value === 'N/A') return t('comun.noDisponible');
  return value;
}

/** Collapsible card with the lifeguard flag, coverage dates and schedule. */
const RedCrossCard: React.FC<{
  redCross?: BeachDetail['cruzRoja'];
  /** Beach whose operator names the card; absent = the legacy Cruz Roja one. */
  beach?: Pick<BeachDetail, 'fuenteBanderas'>;
}> = ({ redCross, beach }) => {
  const { t, language } = useLanguage();
  const operator = lifeguardOperator(beach);
  const status = flagStatus(redCross);
  const hasData = status === 'color';
  // It can also be expanded outside of hours to see coverage/schedule.
  const expandable = status !== 'sinDatos';
  const [expanded, setExpanded] = useState(hasData);

  // No operator watches this beach: there is no flag service to report, and an
  // empty card would read as "the data failed" instead of "there is none".
  if (!operator) return null;

  const operatorName = translateOperator(operator, language);

  return (
    <div className="detail-disclosure">
      <div
        className={`card-header${!expandable ? ' card-header-disabled' : ''}`}
        onClick={expandable ? () => setExpanded((v) => !v) : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? 'cruzroja-content' : undefined}
        aria-label={expandable ? `${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${operatorName}` : undefined}
        aria-disabled={!expandable ? true : undefined}
        onKeyDown={expandable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <div>
          <div className="card-header-title">{operatorName}</div>
          <div className="card-header-subtitle">
            {hasData
              ? t('cruzroja.vigilanciaCobertura')
              : status === 'fueraDeHorario'
                ? t('bandera.fueraDeHorario')
                : t('cruzroja.sinInfo', { operador: operatorName })}
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
                  ? translateApiText(redCross!.bandera, language)
                  : status === 'fueraDeHorario'
                    ? t('bandera.fueraDeHorario')
                    : t('comun.noDisponible')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaDesde')}</span>
              <span className={`info-row-value ${!redCross?.coberturaDesde ? 'muted' : ''}`}>
                {redCrossField(redCross?.coberturaDesde, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaHasta')}</span>
              <span className={`info-row-value ${!redCross?.coberturaHasta ? 'muted' : ''}`}>
                {redCrossField(redCross?.coberturaHasta, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.horario')}</span>
              <span className={`info-row-value ${!redCross?.horario ? 'muted' : ''}`}>
                {redCrossField(redCross?.horario, t)}
              </span>
            </div>
          </div>
          {normalizeInstant(redCross?.ultimaActualizacion) != null && (
            <p className="cruzroja-actualizado">
              <FreshnessLabel instant={redCross?.ultimaActualizacion} capitalized />
            </p>
          )}
          {/* Quién publica esto, enlazado a su propio servicio. Va aquí y no
              solo en el banner porque esta tarjeta se pinta también cuando no
              hay bandera vigente: la cobertura y el horario siguen siendo
              suyos y hay que acreditarlos igual. */}
          <DataInfo label="info.fuente" aria="info.aria.vigilancia">
            <AttributionNote source={operator} />
          </DataInfo>
        </div>
      )}
    </div>
  );
};

export default RedCrossCard;
