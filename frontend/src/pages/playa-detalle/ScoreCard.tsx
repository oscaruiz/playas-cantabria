import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { warningOutline, chevronDownOutline } from 'ionicons/icons';
import { FeaturedBeach, SubPuntuaciones } from '../../services/api';
import ScoreBadge from '../../components/ScoreBadge';
import TrendBadge from '../../components/TrendBadge';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import { ClaveTexto } from '../../shared/i18n/es';
import {
  traducirTextoApi,
  razonLegible,
  claveNivelVientoMs,
  sinFragmentoDePronostico,
} from '../../shared/i18n/apiText';

/** Cap values applied by the backend (`RAIN_SCORE_CAP` / `RAIN_FORECAST_SCORE_CAP`). */
const TOPES: Record<'lluvia' | 'lluvia_prevista', { clave: ClaveTexto; valor: number }> = {
  lluvia: { clave: 'detalle.scoreInfo.topeLluvia', valor: 55 },
  lluvia_prevista: { clave: 'detalle.scoreInfo.topeLluviaPrevista', valor: 59 },
};

/** Reachable maximum of each factor when the backend does not send `maximos`. */
const MAXIMOS_POR_DEFECTO: SubPuntuaciones = {
  cielo: 25, temperatura: 25, bandera: 20, viento: 15, oleaje: 10, datos: 5,
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
const FACTORES: Array<{ campo: keyof SubPuntuaciones; clave: ClaveTexto }> = [
  { campo: 'cielo', clave: 'detalle.scoreInfo.sol' },
  { campo: 'temperatura', clave: 'detalle.scoreInfo.temp' },
  { campo: 'bandera', clave: 'detalle.scoreInfo.bandera' },
  { campo: 'viento', clave: 'detalle.scoreInfo.viento' },
  { campo: 'oleaje', clave: 'detalle.scoreInfo.oleaje' },
  { campo: 'datos', clave: 'detalle.scoreInfo.datos' },
];

/** Rules that cap or exclude: they do not score, so they carry no points. */
const REGLAS: ClaveTexto[] = ['detalle.scoreInfo.lluvia', 'detalle.scoreInfo.peligro'];

/** "Concept: description" → the two halves the row paints. */
function partirTexto(texto: string): { etiqueta: string; descripcion: string } {
  const sep = texto.indexOf(':');
  return sep >= 0
    ? { etiqueta: texto.slice(0, sep), descripcion: texto.slice(sep + 1).trim() }
    : { etiqueta: texto, descripcion: '' };
}

/** Today's score with its reason, and a disclosure explaining how it is computed. */
const ScoreCard: React.FC<{
  puntuada: FeaturedBeach;
  maximos?: SubPuntuaciones | null;
}> = ({ puntuada, maximos }) => {
  const { t, idioma } = useIdioma();
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);

  const pronostico = puntuada.pronostico ?? null;
  const desglose = puntuada.subpuntuaciones ?? null;
  const escala = maximos ?? MAXIMOS_POR_DEFECTO;
  const tope = puntuada.topeAplicado ? TOPES[puntuada.topeAplicado] : null;

  const razon = pronostico
    ? sinFragmentoDePronostico(puntuada.razonRanking)
    : puntuada.razonRanking;
  const motivo = pronostico && puntuada.motivoBaja
    ? sinFragmentoDePronostico(puntuada.motivoBaja)
    : puntuada.motivoBaja;

  /** What this beach shows next to each factor: the datum that explains the points. */
  const valorDe = (campo: keyof SubPuntuaciones): string => {
    switch (campo) {
      case 'cielo':
        return traducirTextoApi(puntuada.descripcionClima, idioma) || t('detalle.scoreInfo.sinDato');
      case 'temperatura':
        return puntuada.temperatura != null
          ? `${Math.round(puntuada.temperatura)}°`
          : t('detalle.scoreInfo.sinDato');
      case 'bandera':
        return puntuada.bandera
          ? traducirTextoApi(puntuada.bandera, idioma)
          : t('detalle.scoreInfo.sinBanderaAhora');
      case 'viento':
        return puntuada.vientoMs != null
          ? `${t(claveNivelVientoMs(puntuada.vientoMs))}, ${Math.round(puntuada.vientoMs)} m/s`
          : t('detalle.scoreInfo.sinDato');
      case 'oleaje':
        return puntuada.oleaje
          ? traducirTextoApi(puntuada.oleaje, idioma)
          : t('detalle.scoreInfo.sinDato');
      case 'datos':
        return desglose && desglose.datos >= escala.datos
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
        <ScoreBadge puntuacion={puntuada.puntuacion} size="lg" />
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
          {razon && (
            <p className="pd-score-reason">
              {traducirTextoApi(razonLegible(razon), idioma)}
            </p>
          )}
          {/* Where the day is going, visible without opening anything: it is the
              most actionable line on the screen. */}
          <TrendBadge pronostico={pronostico} size="lg" />
          {motivo && (
            <p className="pd-score-caveat">
              <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
              {traducirTextoApi(motivo, idioma)}
            </p>
          )}
        </div>
      </button>

      {scoreInfoOpen && (
        <div id="pd-score-info" className="pd-score-info">
          <p className="pd-score-info-intro">{t('detalle.scoreInfo.intro')}</p>

          {/* Why THIS beach scored what it scored. */}
          {desglose && (
            <>
              <p className="pd-score-info-sub">{t('detalle.scoreInfo.deEstaPlaya')}</p>
              <div className="pd-factores">
                {FACTORES.map(({ campo, clave }) => {
                  const { etiqueta, descripcion } = partirTexto(t(clave));
                  const puntos = desglose[campo];
                  const max = escala[campo];
                  return (
                    <div className="pd-factor" key={campo}>
                      <span className="pd-factor-nombre">{etiqueta}</span>
                      <span className="pd-factor-valor">{valorDe(campo)}</span>
                      <span className="pd-factor-puntos">
                        {t('detalle.scoreInfo.puntos', { n: puntos, max })}
                      </span>
                      <span className="pd-factor-barra" aria-hidden="true">
                        <span
                          className="pd-factor-relleno"
                          style={{ width: `${Math.max(0, Math.min(100, (puntos / max) * 100))}%` }}
                        />
                      </span>
                      <span className="pd-factor-nota">{descripcion}</span>
                    </div>
                  );
                })}
              </div>
              {/* Without this line the numbers look broken: they add up to more
                  than the score because a cap clipped it. */}
              {tope && (
                <p className="pd-score-tope">
                  <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
                  {t(tope.clave, { n: tope.valor })}
                </p>
              )}
            </>
          )}

          {/* Rules that cap or exclude: they have no points of their own. */}
          <div className="beach-info-grid">
            {REGLAS.map((k) => {
              const { etiqueta, descripcion } = partirTexto(t(k));
              return (
                <div className="beach-info-row" key={k}>
                  <span className="beach-info-label">{etiqueta}</span>
                  <span className="beach-info-value">{descripcion}</span>
                </div>
              );
            })}
          </div>

          <p className="pd-score-info-cierre">{t('detalle.scoreInfo.cierre')}</p>
        </div>
      )}
    </div>
  );
};

export default ScoreCard;
