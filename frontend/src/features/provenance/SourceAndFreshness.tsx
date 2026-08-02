import React from 'react';
import { useIdioma } from '../../i18n/IdiomaContext';
import type { ClaveTexto } from '../../i18n/es';
import { formatearHaceTiempo, capitalizar } from '../../utils/beachHelpers';
import {
  Procedencia,
  normalizarInstante,
  formatearInstanteAbsoluto,
} from './procedencia';
import './provenance.css';

/**
 * Presentation of the provenance model. Three small pieces plus the composed
 * one, so each screen can show exactly what it has — and nothing it doesn't:
 * a missing timestamp or source renders NOTHING, never placeholder text.
 */

/**
 * Relative "updated X ago" (translated, as always) made accessible: a real
 * `<time>` element whose datetime and aria-label carry the absolute instant
 * in Europe/Madrid. Renders null if the instant is absent or unparseable.
 */
export const FreshnessLabel: React.FC<{
  instante: string | number | null | undefined;
  /** Capitalize the visible relative text ("Actualizado hace…"). */
  capitalizado?: boolean;
  className?: string;
}> = ({ instante, capitalizado, className }) => {
  const { t, idioma } = useIdioma();
  const ms = normalizarInstante(instante);
  if (ms == null) return null;
  const relativo = formatearHaceTiempo(ms, t);
  if (!relativo) return null;
  const absoluto = formatearInstanteAbsoluto(ms, idioma);
  return (
    <time
      className={className}
      dateTime={new Date(ms).toISOString()}
      aria-label={absoluto}
      title={absoluto}
    >
      {capitalizado ? capitalizar(relativo) : relativo}
    </time>
  );
};

/** "Datos meteorológicos: {fuente}" (or any other template key). Null without a source. */
export const DataSourceLabel: React.FC<{
  fuente: string | null | undefined;
  /** i18n template with a `{fuente}` placeholder. */
  claveTexto?: ClaveTexto;
}> = ({ fuente, claveTexto = 'detalle.datosMeteo' }) => {
  const { t } = useIdioma();
  if (!fuente) return null;
  return <span>{t(claveTexto, { fuente })}</span>;
};

/**
 * Nature marker for values that are NOT live: static beach information,
 * external services. Just a translated muted line — visible, not alarming.
 */
export const DataStatus: React.FC<{
  clave: ClaveTexto;
  className?: string;
}> = ({ clave, className }) => {
  const { t } = useIdioma();
  return <p className={`procedencia-estatica ${className ?? ''}`.trim()}>{t(clave)}</p>;
};

/**
 * Source and freshness side by side: "Observación de OpenWeather ·
 * actualizado hace 12 min". Each half disappears on its own when its data is
 * missing; with neither, the whole line disappears.
 */
export const SourceAndFreshness: React.FC<{
  procedencia: Procedencia | null;
  claveFuente?: ClaveTexto;
  className?: string;
}> = ({ procedencia, claveFuente, className }) => {
  if (!procedencia || (!procedencia.fuente && procedencia.instanteMs == null)) {
    return null;
  }
  return (
    <div className={`procedencia-linea ${className ?? ''}`.trim()}>
      <DataSourceLabel fuente={procedencia.fuente} claveTexto={claveFuente} />
      {procedencia.fuente && procedencia.instanteMs != null && ' · '}
      <FreshnessLabel instante={procedencia.instanteMs} />
    </div>
  );
};
