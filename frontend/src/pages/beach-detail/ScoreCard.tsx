import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { warningOutline, chevronDownOutline } from 'ionicons/icons';
import { FeaturedBeach, SubScores } from '../../services/api';
import { isRainActive } from '../../utils/beachHelpers';
import ScoreBadge from '../../components/ScoreBadge';
import TrendBadge from '../../components/TrendBadge';
import { useLanguage } from '../../shared/i18n/LanguageContext';
import { TextKey } from '../../shared/i18n/es';
import SafetyNotice from '../../shared/ui/SafetyNotice';
import {
  translateApiText,
  readableReason,
  windLevelKey,
  noForecastFragment,
} from '../../shared/i18n/apiText';

/**
 * Cap texts, with the value the backend used to apply when it did not send
 * `topeValor`. The forecast cap is graded now (59 imminent → none at 6 h), so
 * the published value wins; 59 is only the floor an old backend enforced.
 */
const CAPS: Record<'lluvia' | 'lluvia_prevista', { labelKey: TextKey; value: number }> = {
  lluvia: { labelKey: 'detalle.scoreInfo.topeLluvia', value: 55 },
  lluvia_prevista: { labelKey: 'detalle.scoreInfo.topeLluviaPrevista', value: 59 },
};

/** Reachable maximum of each factor when the backend does not send `maximos`. */
const DEFAULT_MAXIMA: SubScores = {
  cielo: 25, temperatura: 25, bandera: 10, viento: 25, oleaje: 10, datos: 5,
};

/**
 * The six factors that actually score, in weight order. The text of each key
 * is "Concept: description": the concept labels the row and the description —
 * the generic explanation the panel showed on its own — stays as secondary
 * text, so nothing that was there is lost.
 *
 * UV is NOT among them: it stopped scoring (it docked points from every clear
 * summer day, which are the days worth going) and it would be dishonest to
 * list it here. The index is still shown further down the page as data.
 */
const FACTORS: Array<{ field: keyof SubScores; labelKey: TextKey }> = [
  { field: 'cielo', labelKey: 'detalle.scoreInfo.sol' },
  { field: 'temperatura', labelKey: 'detalle.scoreInfo.temp' },
  { field: 'viento', labelKey: 'detalle.scoreInfo.viento' },
  { field: 'bandera', labelKey: 'detalle.scoreInfo.bandera' },
  { field: 'oleaje', labelKey: 'detalle.scoreInfo.oleaje' },
  { field: 'datos', labelKey: 'detalle.scoreInfo.datos' },
];

/** Rules that cap or exclude: they do not score, so they carry no points. */
const RULES: TextKey[] = ['detalle.scoreInfo.lluvia', 'detalle.scoreInfo.peligro'];

/** "Concept: description" → the two halves the row paints. */
function splitText(text: string): { label: string; description: string } {
  const sep = text.indexOf(':');
  return sep >= 0
    ? { label: text.slice(0, sep), description: text.slice(sep + 1).trim() }
    : { label: text, description: '' };
}

/** Today's score with its reason, and a disclosure explaining how it is computed. */
const ScoreCard: React.FC<{
  scored: FeaturedBeach;
  maxima?: SubScores | null;
}> = ({ scored, maxima }) => {
  const { t, language } = useLanguage();
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);

  const outlook = scored.pronostico ?? null;
  const breakdown = scored.subpuntuaciones ?? null;
  const scale = maxima ?? DEFAULT_MAXIMA;
  const cap = scored.topeAplicado
    ? { ...CAPS[scored.topeAplicado], valor: scored.topeValor ?? CAPS[scored.topeAplicado].value }
    : null;

  const rationale = outlook
    ? noForecastFragment(scored.razonRanking)
    : scored.razonRanking;
  const reason = outlook && scored.motivoBaja
    ? noForecastFragment(scored.motivoBaja)
    : scored.motivoBaja;

  /** What this beach shows next to each factor: the datum that explains the points. */
  const valueFor = (field: keyof SubScores): string => {
    switch (field) {
      case 'cielo':
        // The live rain signal of THIS scored payload wins over the model's
        // cloud text: "Nubes" here next to the hero's "lloviendo ahora" badge
        // read as a contradiction. The points stay as they are — rain does not
        // score the sky, it caps the total (the rule listed below).
        if (isRainActive({ cielo: scored.descripcionClima, lluvia: scored.lluvia ?? null })) {
          return translateApiText('Lluvia', language);
        }
        return translateApiText(scored.descripcionClima, language) || t('detalle.scoreInfo.sinDato');
      case 'temperatura':
        return scored.temperatura != null
          ? `${Math.round(scored.temperatura)}°`
          : t('detalle.scoreInfo.sinDato');
      case 'bandera':
        return scored.bandera
          ? translateApiText(scored.bandera, language)
          : t('detalle.scoreInfo.sinBanderaAhora');
      case 'viento':
        return scored.vientoMs != null
          ? `${t(windLevelKey(scored.vientoMs))}, ${Math.round(scored.vientoMs)} m/s`
          : t('detalle.scoreInfo.sinDato');
      case 'oleaje':
        return scored.oleaje
          ? translateApiText(scored.oleaje, language)
          : t('detalle.scoreInfo.sinDato');
      case 'datos':
        return breakdown && breakdown.datos >= scale.datos
          ? t('detalle.scoreInfo.datosCompletos')
          : t('detalle.scoreInfo.datosParciales');
      default:
        return '';
    }
  };

  return (
    <div className="pd-score-block">
      <button
        type="button"
        className="pd-score-card pd-score-card--btn"
        onClick={() => setScoreInfoOpen((o) => !o)}
        aria-expanded={scoreInfoOpen}
        aria-controls="pd-score-info"
      >
        <ScoreBadge score={scored.puntuacion} size="lg" />
        <div className="pd-score-text">
          <p className="pd-score-label">
            <span>{t('detalle.puntuacion')}</span>
            <span className="pd-score-help">
              {t('detalle.comoSeCalcula')}
              <IonIcon
                icon={chevronDownOutline}
                className={`pd-score-chevron${scoreInfoOpen ? ' open' : ''}`}
                aria-hidden="true"
              />
            </span>
          </p>
          {rationale && (
            <p className="pd-score-reason">
              {translateApiText(readableReason(rationale), language)}
            </p>
          )}
          {/* Where the day is going, visible without opening anything: it is the
              most actionable line on the screen. */}
          <TrendBadge outlook={outlook} size="lg" />
          {reason && (
            <p className="pd-score-caveat">
              <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
              {translateApiText(reason, language)}
            </p>
          )}
        </div>
      </button>

      <SafetyNotice kind="ranking" onDark />

      {scoreInfoOpen && (
        <div id="pd-score-info" className="pd-score-info">
          {/* Lo primero de la explicación, y no una segunda ⓘ compitiendo con
              esta: quien abre "cómo se calcula" ya está preguntando cuánto
              puede fiarse del número. */}
          <p className="pd-score-info-intro">{t('detalle.scoreInfo.intro')}</p>

          {/* Why THIS beach scored what it scored. */}
          {breakdown && (
            <>
              <p className="pd-score-info-sub">{t('detalle.scoreInfo.deEstaPlaya')}</p>
              <div className="pd-factores">
                {FACTORS.map(({ field, labelKey: key }) => {
                  const { label, description } = splitText(t(key));
                  const points = breakdown[field];
                  const max = scale[field];
                  return (
                    <div className="pd-factor" key={field}>
                      <span className="pd-factor-name">{label}</span>
                      <span className="pd-factor-value">{valueFor(field)}</span>
                      <span className="pd-factor-points">
                        {t('detalle.scoreInfo.puntos', { n: points, max })}
                      </span>
                      <span className="pd-factor-bar" aria-hidden="true">
                        <span
                          className="pd-factor-fill"
                          style={{ width: `${Math.max(0, Math.min(100, (points / max) * 100))}%` }}
                        />
                      </span>
                      <span className="pd-factor-note">{description}</span>
                    </div>
                  );
                })}
              </div>
              {/* Without this line the numbers look broken: they add up to more
                  than the score because a cap clipped it. */}
              {cap && (
                <p className="pd-score-cap">
                  <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
                  {t(cap.labelKey, { n: cap.valor })}
                </p>
              )}
            </>
          )}

          {/* Rules that cap or exclude: they have no points of their own. */}
          <div className="beach-info-grid">
            {RULES.map((k) => {
              const { label, description } = splitText(t(k));
              return (
                <div className="beach-info-row" key={k}>
                  <span className="beach-info-label">{label}</span>
                  <span className="beach-info-value">{description}</span>
                </div>
              );
            })}
          </div>

          <p className="pd-score-info-closing">{t('detalle.scoreInfo.cierre')}</p>
        </div>
      )}
    </div>
  );
};

export default ScoreCard;
