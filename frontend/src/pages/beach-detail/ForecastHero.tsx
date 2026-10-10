import React from 'react';
import { BeachDetail, ForecastDayDTO } from '../../services/api';
import {
  skyEmoji,
  isRainActive,
  expectedRain,
  skyWord,
} from '../../utils/beachHelpers';
import { madridLocalHour } from '../../shared/format/time';
import { capitalize } from '../../shared/format/text';
import { useLanguage } from '../../shared/i18n/LanguageContext';
import { translateApiText } from '../../shared/i18n/apiText';
import { observationProvenance, currentObservation } from '../../features/provenance/provenance';
import {
  FreshnessLabel,
  SourceAndFreshness,
} from '../../features/provenance/SourceAndFreshness';

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
  const { t } = useLanguage();
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
  const { t } = useLanguage();
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
  day: ForecastDayDTO;
  currentWeather?: number | null;
  currentConditions?: BeachDetail['tiempoActual'];
}> = ({ day, currentWeather, currentConditions: received }) => {
  const { t, language } = useLanguage();
  // An observation older than the limit is NOT "now": it is dropped here, at
  // the single point where it enters the headline, so no downstream line
  // (sky, temperature, rain badges, freshness) can keep presenting it as
  // current. What it was is reported below, in its own line.
  const inForce = currentObservation(received);
  const currentConditions = inForce ? received : undefined;
  const expired = received != null && !inForce;
  // skyText/viento/oleaje are the raw Spanish from the API: skyEmoji and
  // windSpeedLevel run regexes over it — translate only when displaying.
  // For TODAY we prioritize the real observation ("now") over the afternoon
  // forecast; that way the headline stops contradicting the morning/afternoon breakdown.
  const skyText = capitalize(currentConditions?.cielo ?? day.tarde.cielo ?? day.manana.cielo ?? '');
  // TODAY's headline is read as "now", so a sky that is not observed says so:
  // AEMET's forecast standing in (`previsto`) or the half-day forecast below
  // it. On the other days every value is a forecast and the panel says it.
  const isToday = received !== undefined;
  const skyIsForecast = isToday && !!skyText && !(currentConditions?.cielo && !currentConditions.previsto);
  const wind = capitalize(day.tarde.viento ?? day.manana.viento ?? '');
  const waves = capitalize(day.tarde.oleaje ?? day.manana.oleaje ?? '');
  // Only TODAY's observation knows whether it is night; a forecast for the day
  // after tomorrow does not describe a specific instant, so it is painted as day.
  const isNight = currentConditions?.esNoche === true;
  const skyGlyph = skyEmoji(skyText || null, isNight);

  // The headline temperature is part of the same "right now" reading: if that
  // reading is too old, it falls back to the forecast maximum, and where there
  // is none (beaches with no AEMET sheet) it simply is not shown.
  const observedTemp = inForce ? currentWeather : null;
  const mainTemp = observedTemp ?? day.temperaturaMaxima;
  const showMax = observedTemp != null && day.temperaturaMaxima != null && observedTemp <= day.temperaturaMaxima;
  const wLevel = wind ? windSpeedLevel(wind) : 1;

  // Rain detected NOW (multi-source signal from the backend). `tiempoActual`
  // only arrives when the selected day is TODAY, so the badge is not
  // shown on future days.
  const raining = isRainActive(currentConditions);
  const rainMm = currentConditions?.lluvia?.mm ?? currentConditions?.precipitacionMm ?? null;
  // FORECAST rain (next few hours). Null if it is already raining: never two badges.
  const expected = expectedRain(currentConditions);
  const expectedHour = madridLocalHour(expected?.desdeIso);

  return (
    <div className="forecast-hero">
      <div className="forecast-hero-main">
        <div className="forecast-hero-col">
          <span className="forecast-hero-icon-emoji">{raining ? '\u{1F327}\uFE0F' : skyGlyph}</span>
          {mainTemp != null && (
            <span className="forecast-hero-temp">{Math.round(mainTemp)}&deg;</span>
          )}
          {showMax && (
            <span className="forecast-hero-max">{t('detalle.max')} {day.temperaturaMaxima}&deg;</span>
          )}
          {raining && (
            <span className="forecast-hero-rain" role="status">
              {currentConditions?.lluvia?.ultimaHora ? t('detalle.lluviaUltimaHora') : t('detalle.lloviendoAhora')}
              {rainMm != null && rainMm > 0 && ` · ${rainMm.toFixed(1)} mm`}
            </span>
          )}
          {expected && (
            <span className="forecast-hero-rain forecast-hero-rain-expected" role="status">
              {expectedHour
                ? t('detalle.lluviaPrevistaHora', { hora: expectedHour })
                : t('detalle.lluviaPrevistaHoy')}
            </span>
          )}
          {/* The app's word, not the provider's: the score card on this SAME
              screen says "Sol" and here it read "Cielo claro" for the same
              sky. If we do not recognise it, the raw text is shown rather
              than losing the data. */}
          {skyText ? (
            <span className="forecast-hero-sky">
              {translateApiText(skyWord(skyText, isNight) ?? skyText, language)}
              {skyIsForecast && ` · ${t('cielo.previsto')}`}
            </span>
          ) : isToday && (
            <span className="forecast-hero-sky">{t('cielo.noDisponible')}</span>
          )}
          {day.temperaturaAgua != null && (
            <span className="forecast-hero-water">{t('detalle.aguaGrados', { temp: day.temperaturaAgua })}</span>
          )}
        </div>
        {wind && <WindTurbine level={wLevel} label={translateApiText(wind, language)} />}
        {waves && <WavesIndicator label={translateApiText(waves, language)} />}
      </div>
      {/* The headline mixes observation over forecast (skyText above): say
          who observed it and when, or the freshest value has no face. */}
      {expired ? (
        /* It says it is missing, and since when: staying silent would let the
           forecast pass as an observation with no one able to notice. */
        <p className="provenance-line provenance-expired">
          {t('datos.noDisponible')}{' '}
          <FreshnessLabel instant={received?.timestamp} />
        </p>
      ) : (
        <SourceAndFreshness
          provenance={observationProvenance(currentConditions)}
          sourceKey="datos.enDirectoFuente"
        />
      )}
      {/* The observer's licence note is no longer painted here: it travels
          with the rest of what this column declares, under the ⓘ that closes
          it. What remains is freshness, which is not fine print but the data. */}
    </div>
  );
};

export default ForecastHero;
