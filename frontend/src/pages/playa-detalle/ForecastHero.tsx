import React from 'react';
import { PlayaDetalle as PlayaDetalleData, DiaPrediccionDTO } from '../../services/api';
import {
  emojiCielo,
  esLluviaActiva,
  lluviaPrevista,
} from '../../utils/beachHelpers';
import { horaLocalMadrid } from '../../shared/format/tiempo';
import { capitalizar } from '../../shared/format/texto';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import { traducirTextoApi } from '../../shared/i18n/apiText';
import { procedenciaObservacion } from '../../features/provenance/procedencia';
import { SourceAndFreshness } from '../../features/provenance/SourceAndFreshness';

/** Map wind description text to a speed level 0–4 for animation. */
function windSpeedLevel(text: string): number {
  const t = text.toLowerCase();
  if (/calma|en calma/.test(t)) return 0;
  if (/flojo|d[eé]bil|ligero|suave/.test(t)) return 1;
  if (/moderado|variable/.test(t)) return 2;
  if (/fresco/.test(t)) return 3;
  if (/fuerte|muy fuerte|intenso/.test(t)) return 4;
  return 1; // default: light animation
}

/**
 * Duration (seconds) of the animation per wind level. Level 0 (calm) does not
 * stop entirely: it spins very slowly so the turbine looks "alive" and not broken.
 */
const WIND_DURATIONS = [7, 4, 2, 1, 0.5];

const WindTurbine: React.FC<{ level: number; label: string }> = ({ level, label }) => {
  const { t } = useIdioma();
  const duration = WIND_DURATIONS[level] ?? 2;
  const paused = false;

  return (
    <div className="wind-turbine-wrap">
      <div className="wind-turbine-icon">
        <svg viewBox="0 0 40 44" className="wind-turbine-svg">
          {/* Pole */}
          <line x1="20" y1="18" x2="20" y2="43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Hub */}
          <circle cx="20" cy="18" r="2" fill="currentColor" />
          {/* Blades */}
          <g
            className="wind-turbine-blades"
            style={{
              transformOrigin: '20px 18px',
              animationDuration: `${duration}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            <path d="M20,18 L18.5,3 Q20,1 21.5,3 Z" fill="currentColor" opacity="0.85" />
            <path d="M20,18 L31,25.5 Q31.5,23 29.5,22 Z" fill="currentColor" opacity="0.85" />
            <path d="M20,18 L9,25.5 Q8.5,23 10.5,22 Z" fill="currentColor" opacity="0.85" />
          </g>
        </svg>
      </div>
      <span className="forecast-indicator-title">{t('detalle.viento')}</span>
      <span className="forecast-indicator-label">{label}</span>
    </div>
  );
};

const WavesIndicator: React.FC<{ label: string }> = ({ label }) => {
  const { t } = useIdioma();
  return (
  <div className="waves-indicator-wrap">
    <div className="waves-indicator-icon">
      <svg viewBox="0 0 40 28" className="waves-indicator-svg">
        <g className="waves-anim">
          <path d="M-10,14 Q-5,8 0,14 Q5,20 10,14 Q15,8 20,14 Q25,20 30,14 Q35,8 40,14 Q45,20 50,14"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-10,22 Q-5,16 0,22 Q5,28 10,22 Q15,16 20,22 Q25,28 30,22 Q35,16 40,22 Q45,28 50,22"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      </svg>
    </div>
    <span className="forecast-indicator-title">{t('detalle.oleaje')}</span>
    <span className="forecast-indicator-label">{label}</span>
  </div>
  );
};

/** Big icon + temperature + rain badges for the selected day. */
const ForecastHero: React.FC<{
  dia: DiaPrediccionDTO;
  climaActual?: number | null;
  tiempoActual?: PlayaDetalleData['tiempoActual'];
}> = ({ dia, climaActual, tiempoActual }) => {
  const { t, idioma } = useIdioma();
  // skyText/viento/oleaje are the raw Spanish from the API: emojiCielo and
  // windSpeedLevel run regexes over it — translate only when displaying.
  // For TODAY we prioritize the real observation ("now") over the afternoon
  // forecast; that way the headline stops contradicting the morning/afternoon breakdown.
  const skyText = capitalizar(tiempoActual?.cielo ?? dia.tarde.cielo ?? dia.manana.cielo ?? '');
  const viento = capitalizar(dia.tarde.viento ?? dia.manana.viento ?? '');
  const oleaje = capitalizar(dia.tarde.oleaje ?? dia.manana.oleaje ?? '');
  const skyEmoji = emojiCielo(skyText || null);

  const tempPrincipal = climaActual ?? dia.temperaturaMaxima;
  const showMax = climaActual != null && dia.temperaturaMaxima != null && climaActual <= dia.temperaturaMaxima;
  const wLevel = viento ? windSpeedLevel(viento) : 1;

  // Rain detected NOW (multi-source signal from the backend). `tiempoActual`
  // only arrives when the selected day is TODAY, so the badge is not
  // shown on future days.
  const lloviendo = esLluviaActiva(tiempoActual);
  const mmLluvia = tiempoActual?.lluvia?.mm ?? tiempoActual?.precipitacionMm ?? null;
  // FORECAST rain (next few hours). Null if it is already raining: never two badges.
  const prevista = lluviaPrevista(tiempoActual);
  const horaPrevista = horaLocalMadrid(prevista?.desdeIso);

  return (
    <div className="forecast-hero">
      <div className="forecast-hero-main">
        <div className="forecast-hero-col">
          <span className="forecast-hero-icon-emoji">{lloviendo ? '\u{1F327}\uFE0F' : skyEmoji}</span>
          {tempPrincipal != null && (
            <span className="forecast-hero-temp">{Math.round(tempPrincipal)}&deg;</span>
          )}
          {showMax && (
            <span className="forecast-hero-max">{t('detalle.max')} {dia.temperaturaMaxima}&deg;</span>
          )}
          {lloviendo && (
            <span className="forecast-hero-lluvia" role="status">
              {tiempoActual?.lluvia?.ultimaHora ? t('detalle.lluviaUltimaHora') : t('detalle.lloviendoAhora')}
              {mmLluvia != null && mmLluvia > 0 && ` · ${mmLluvia.toFixed(1)} mm`}
            </span>
          )}
          {prevista && (
            <span className="forecast-hero-lluvia forecast-hero-lluvia-prevista" role="status">
              {horaPrevista
                ? t('detalle.lluviaPrevistaHora', { hora: horaPrevista })
                : t('detalle.lluviaPrevistaHoy')}
            </span>
          )}
          {skyText && <span className="forecast-hero-sky">{traducirTextoApi(skyText, idioma)}</span>}
          {dia.temperaturaAgua != null && (
            <span className="forecast-hero-agua">{t('detalle.aguaGrados', { temp: dia.temperaturaAgua })}</span>
          )}
        </div>
        {viento && <WindTurbine level={wLevel} label={traducirTextoApi(viento, idioma)} />}
        {oleaje && <WavesIndicator label={traducirTextoApi(oleaje, idioma)} />}
      </div>
      {/* The headline mixes observation over forecast (skyText above): say
          who observed it and when, or the freshest value has no face. */}
      <SourceAndFreshness
        procedencia={procedenciaObservacion(tiempoActual)}
        claveFuente="datos.enDirectoFuente"
      />
    </div>
  );
};

export default ForecastHero;
