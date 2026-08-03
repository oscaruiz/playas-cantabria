import React from 'react';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import type { ClaveTexto } from '../../shared/i18n/es';
import type { CampoEstimado } from '../../services/api';
import { formatearHaceTiempo } from '../../shared/format/tiempo';
import { capitalizar } from '../../shared/format/texto';
import {
  Procedencia,
  normalizarInstante,
  formatearInstanteAbsoluto,
} from './procedencia';
import { atribucionDeFuente } from './atribuciones';
import './provenance.css';

/**
 * Marker interpolated into the template's `{fuente}` slot and then split on.
 * That is what lets the LINK be the source's name alone instead of the whole
 * sentence, without splitting every phrase into two halves in the dictionaries.
 * It never survives to the DOM: it is always consumed by the split.
 */
const HUECO = '@@FUENTE@@';

/**
 * A template with a `{fuente}` slot, rendered with the source credited and
 * linked to its own terms. An unknown source still gets its name — plain,
 * because we have no page to send the user to.
 */
const TextoConFuente: React.FC<{ clave: ClaveTexto; fuente: string }> = ({ clave, fuente }) => {
  const { t } = useIdioma();
  const atribucion = atribucionDeFuente(fuente);
  const [antes, despues = ''] = t(clave, { fuente: HUECO }).split(HUECO);
  return (
    <>
      {antes}
      {atribucion ? (
        <a
          className="procedencia-enlace"
          href={atribucion.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {atribucion.nombre}
        </a>
      ) : (
        fuente
      )}
      {despues}
    </>
  );
};

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

/**
 * "Datos meteorológicos: {fuente}" (or any other template key), with the
 * source's name linked to its own terms. Null without a source.
 */
export const DataSourceLabel: React.FC<{
  fuente: string | null | undefined;
  /** i18n template with a `{fuente}` placeholder. */
  claveTexto?: ClaveTexto;
}> = ({ fuente, claveTexto = 'detalle.datosMeteo' }) => {
  if (!fuente) return null;
  return (
    <span>
      <TextoConFuente clave={claveTexto} fuente={fuente} />
    </span>
  );
};

/**
 * The notice a source's licence requires NEXT TO its data — AEMET's wording,
 * OpenWeather's credit, Open-Meteo's "adapted by" — with the name linked.
 *
 * Renders nothing for a source with no notice, or one we do not know: an
 * invented attribution would be worse than a missing one.
 */
export const AttributionNote: React.FC<{
  fuente: string | null | undefined;
  className?: string;
}> = ({ fuente, className }) => {
  const atribucion = atribucionDeFuente(fuente);
  if (!fuente || !atribucion?.nota) return null;
  return (
    <p className={`procedencia-atribucion ${className ?? ''}`.trim()}>
      <TextoConFuente clave={atribucion.nota} fuente={fuente} />
    </p>
  );
};

/**
 * Which values of a panel are DERIVED rather than measured or forecast, as one
 * line instead of a badge per row: the point is that the reader knows they are
 * not readings, and five markers scattered over a card say that worse than one
 * sentence naming them.
 *
 * Renders nothing when nothing was estimated — which is the normal case on a
 * beach with a full AEMET sheet.
 */
export const EstimatedValues: React.FC<{
  campos: CampoEstimado[] | null | undefined;
  className?: string;
}> = ({ campos, className }) => {
  const { t } = useIdioma();
  if (!campos || campos.length === 0) return null;
  const nombres = campos.map((c) => t(`datos.estimado.${c}` as ClaveTexto));
  return (
    <p className={`procedencia-estatica ${className ?? ''}`.trim()}>
      {t('datos.estimados', { campos: nombres.join(', ') })}
    </p>
  );
};

/**
 * When the backend actually built this payload, and whether we are therefore
 * looking at a cached copy. The details endpoint answers from a
 * stale-while-revalidate cache, so "I just loaded the page" says nothing about
 * how old the numbers are.
 *
 * `umbralCacheMs` is the age past which the copy is no longer the one this
 * request produced. It matches the backend's fresh TTL: below it, the answer
 * is what a recomputation would have given anyway.
 */
export const ComputedAt: React.FC<{
  generadoEn: string | null | undefined;
  umbralCacheMs?: number;
  className?: string;
}> = ({ generadoEn, umbralCacheMs = 10 * 60 * 1000, className }) => {
  const { t, idioma } = useIdioma();
  const ms = normalizarInstante(generadoEn);
  if (ms == null) return null;
  const desdeCache = Date.now() - ms > umbralCacheMs;
  // The absolute instant, not "X ago": this is the one line that answers
  // "date and time of last update" for the whole page, and the relative
  // wording is already taken by each block's own freshness.
  const absoluto = formatearInstanteAbsoluto(ms, idioma);
  return (
    <p className={`procedencia-estatica ${className ?? ''}`.trim()}>
      {t('datos.calculado', {
        hace: '',
      }).trim()}{' '}
      <time dateTime={new Date(ms).toISOString()}>{absoluto}</time>
      {desdeCache && ` · ${t('datos.desdeCache')}`}
    </p>
  );
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
