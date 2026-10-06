import React from 'react';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import type { TextKey } from '../../shared/i18n/es';
import type { EstimatedField } from '../../services/api';
import { formatTimeAgo } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import { capitalize } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/text';
import {
  Provenance,
  normalizeInstant,
  formatAbsoluteInstant,
  STALE_DATA_THRESHOLD_MS,
} from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import { sourceAttribution } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/attributions';
import './provenance.css';

/**
 * Marker interpolated into the template's `{fuente}` slot and then split on.
 * That is what lets the LINK be the source's name alone instead of the whole
 * sentence, without splitting every phrase into two halves in the dictionaries.
 * It never survives to the DOM: it is always consumed by the split.
 */
const GAP = '@@FUENTE@@';

/**
 * A template with a `{fuente}` slot, rendered with the source credited and
 * linked to its own terms. An unknown source still gets its name — plain,
 * because we have no page to send the user to.
 */
const TextWithSource: React.FC<{ labelKey: TextKey; source: string }> = ({ labelKey: key, source }) => {
  const { t } = useLanguage();
  const attribution = sourceAttribution(source);
  const [before, after = ''] = t(key, { fuente: GAP }).split(GAP);
  return (
    <>
      {before}
      {attribution ? (
        <a
          className="provenance-link"
          href={attribution.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {attribution.name}
        </a>
      ) : (
        source
      )}
      {after}
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
  instant: string | number | null | undefined;
  /** Capitalize the visible relative text ("Actualizado hace…"). */
  capitalized?: boolean;
  className?: string;
}> = ({ instant, capitalized, className }) => {
  const { t, language } = useLanguage();
  const ms = normalizeInstant(instant);
  if (ms == null) return null;
  const relative = formatTimeAgo(ms, t);
  if (!relative) return null;
  const absolute = formatAbsoluteInstant(ms, language);
  return (
    <time
      className={className}
      dateTime={new Date(ms).toISOString()}
      aria-label={absolute}
      title={absolute}
    >
      {capitalized ? capitalize(relative) : relative}
    </time>
  );
};

/**
 * "Datos meteorológicos: {fuente}" (or any other template key), with the
 * source's name linked to its own terms. Null without a source.
 */
export const DataSourceLabel: React.FC<{
  source: string | null | undefined;
  /** i18n template with a `{fuente}` placeholder. */
  textKey?: TextKey;
}> = ({ source, textKey = 'detalle.datosMeteo' }) => {
  if (!source) return null;
  return (
    <span>
      <TextWithSource labelKey={textKey} source={source} />
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
  source: string | null | undefined;
  className?: string;
}> = ({ source, className }) => {
  const attribution = sourceAttribution(source);
  if (!source || !attribution?.note) return null;
  return (
    <p className={`provenance-attribution ${className ?? ''}`.trim()}>
      <TextWithSource labelKey={attribution.note} source={source} />
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
  fields: EstimatedField[] | null | undefined;
  className?: string;
}> = ({ fields, className }) => {
  const { t } = useLanguage();
  if (!fields || fields.length === 0) return null;
  const names = fields.map((c) => t(`datos.estimado.${c}` as TextKey));
  return (
    <p className={`provenance-static ${className ?? ''}`.trim()}>
      {t('datos.estimados', { campos: names.join(', ') })}
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
 * request produced. It defaults to `UMBRAL_DATOS_VIEJOS_MS`, the same one the
 * ranking uses: the two screens must not disagree about what counts as old.
 */
export const ComputedAt: React.FC<{
  generatedAt: string | null | undefined;
  cacheThresholdMs?: number;
  className?: string;
}> = ({ generatedAt, cacheThresholdMs = STALE_DATA_THRESHOLD_MS, className }) => {
  const { t, language } = useLanguage();
  const ms = normalizeInstant(generatedAt);
  if (ms == null) return null;
  const fromCache = Date.now() - ms > cacheThresholdMs;
  // The absolute instant, not "X ago": this is the one line that answers
  // "date and time of last update" for the whole page, and the relative
  // wording is already taken by each block's own freshness.
  const absolute = formatAbsoluteInstant(ms, language);
  return (
    <p className={`provenance-static ${className ?? ''}`.trim()}>
      {t('datos.calculado', {
        hace: '',
      }).trim()}{' '}
      <time dateTime={new Date(ms).toISOString()}>{absolute}</time>
      {fromCache && ` · ${t('datos.desdeCache')}`}
    </p>
  );
};

/**
 * Nature marker for values that are NOT live: static beach information,
 * external services. Just a translated muted line — visible, not alarming.
 */
export const DataStatus: React.FC<{
  labelKey: TextKey;
  className?: string;
}> = ({ labelKey: key, className }) => {
  const { t } = useLanguage();
  return <p className={`provenance-static ${className ?? ''}`.trim()}>{t(key)}</p>;
};

/**
 * Source and freshness side by side: "Observación de OpenWeather ·
 * actualizado hace 12 min". Each half disappears on its own when its data is
 * missing; with neither, the whole line disappears.
 */
export const SourceAndFreshness: React.FC<{
  provenance: Provenance | null;
  sourceKey?: TextKey;
  className?: string;
}> = ({ provenance, sourceKey, className }) => {
  if (!provenance || (!provenance.source && provenance.instantMs == null)) {
    return null;
  }
  return (
    <div className={`provenance-line ${className ?? ''}`.trim()}>
      <DataSourceLabel source={provenance.source} textKey={sourceKey} />
      {provenance.source && provenance.instantMs != null && ' · '}
      <FreshnessLabel instant={provenance.instantMs} />
    </div>
  );
};
