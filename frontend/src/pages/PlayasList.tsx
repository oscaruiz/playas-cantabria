import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { searchOutline, locateOutline, videocamOutline, starOutline } from 'ionicons/icons';
import { Playa, FeaturedBeach, getPlayas, getFeaturedBeaches } from '../services/api';
import {
  getActiveAttrs,
  emojiCielo,
  webcamDisponible,
  vigilanciaDisponible,
  operadorVigilancia,
  coincidePlaya,
} from '../utils/beachHelpers';
import { useUserLocation } from '../hooks/useUserLocation';
import { useIdioma } from '../i18n/IdiomaContext';
import { ClaveTexto } from '../i18n/es';
import {
  traducirTextoApi,
  razonLegible,
  traducirOperador,
  sinFragmentoDePronostico,
} from '../i18n/apiText';
import ScoreBadge from '../components/ScoreBadge';
import TrendBadge from '../components/TrendBadge';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import { useHistory } from 'react-router-dom';
import FavoriteButton from '../features/favorites/FavoriteButton';
import { useFavoritas } from '../features/favorites/useFavorites';
import { rutaPlaya } from '../seo/beachUrls';
import SeoHead from '../seo/SeoHead';
import './PlayasList.css';

type OrdenMode = 'az' | 'cerca';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PlayasList: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  const [weatherMap, setWeatherMap] = useState<Map<string, FeaturedBeach>>(new Map());
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<OrdenMode>('az');
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const { favoritas } = useFavoritas();
  // There is no error state: `getPlayas` never rejects, it always falls back to the local
  // JSON. What does need to be conveyed is that the data is not fresh.
  const [esFallback, setEsFallback] = useState(false);
  const [datosNoDisponibles, setDatosNoDisponibles] = useState(false);
  const { t, tPlural, idioma } = useIdioma();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const { userLocation } = useUserLocation();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useHistory();

  useEffect(() => {
    getPlayas({
      onFallback: () => setEsFallback(true),
      onFallbackUnavailable: () => {
        setEsFallback(false);
        setDatosNoDisponibles(true);
      },
      onBackendData: (data) => {
        setPlayas(data);
        setEsFallback(false);
        setDatosNoDisponibles(false);
      },
    }).then(setPlayas);

    getFeaturedBeaches()
      .then((res) => {
        const map = new Map<string, FeaturedBeach>();
        for (const b of res.resumenTodas) map.set(b.codigo, b);
        setWeatherMap(map);
      })
      .catch(() => { /* no-op: weather is optional enrichment */ });
  }, []);

  // No toggle needed — two separate buttons

  const suggestions = useMemo(() => {
    if (!playas || filtro.length < 2) return [];
    return playas
      .filter((p) => coincidePlaya(p, filtro))
      .slice(0, 5);
  }, [playas, filtro]);

  const selectSuggestion = useCallback((nombre: string) => {
    setFiltro(nombre);
    setShowSuggestions(false);
    setActiveIdx(-1);
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIdx].nombre);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIdx(-1);
    }
  }, [showSuggestions, suggestions, activeIdx, selectSuggestion]);

  const filtradas = useMemo(() => {
    if (!playas) return [];
    const result = playas.filter(
      (p) => (!soloFavoritas || favoritas.has(p.codigo)) && coincidePlaya(p, filtro)
    );
    if (orden === 'cerca' && userLocation) {
      const [uLat, uLon] = userLocation;
      return result.sort((a, b) =>
        haversineKm(uLat, uLon, a.lat, a.lon) - haversineKm(uLat, uLon, b.lat, b.lon)
      );
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [playas, filtro, orden, userLocation, soloFavoritas, favoritas]);

  return (
    <IonPage className="home-page">
      <SeoHead
        titulo={t('seo.tituloLista')}
        descripcion={t('seo.descLista')}
        rutaCanonica="/playas"
      />
      {/* Sticky header */}
      <div className="home-sticky-header" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
        <h1 className="home-sticky-title">{t('app.titulo')}</h1>
        <p className="home-sticky-subtitle">{t('lista.subtitulo')}</p>
        <SelectorIdioma />
      </div>

      <IonContent fullscreen>
        {/* Hero header spacer */}
        <div className="home-hero">
          <div className="home-hero-spacer" />
        </div>

        {/* Search bar */}
        <div className="search-bar-container">
          <div className="search-bar-inner">
            <IonIcon className="search-icon" icon={searchOutline} aria-hidden="true" />
            <input
              type="text"
              value={filtro}
              onChange={(e) => {
                setFiltro(e.target.value);
                setShowSuggestions(true);
                setActiveIdx(-1);
              }}
              onFocus={() => { if (filtro.length >= 2) setShowSuggestions(true); }}
              onBlur={() => {
                blurTimeout.current = setTimeout(() => setShowSuggestions(false), 150);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('lista.placeholder')}
              aria-label={t('lista.buscarAria')}
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-autocomplete="list"
            />
            {filtro.length > 0 && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setFiltro('');
                  setShowSuggestions(false);
                  setActiveIdx(-1);
                }}
                aria-label={t('lista.borrarBusqueda')}
                type="button"
              >
                &times;
              </button>
            )}
            {userLocation && (
              <button
                className={`sort-button${orden === 'cerca' ? ' sort-button--active' : ''}`}
                onClick={() => setOrden('cerca')}
                title={t('lista.ordenarCercania')}
                aria-label={t('lista.ordenarCercania')}
                aria-pressed={orden === 'cerca'}
              >
                <IonIcon icon={locateOutline} aria-hidden="true" />
              </button>
            )}
            <button
              className={`sort-button${orden === 'az' ? ' sort-button--active' : ''}`}
              onClick={() => setOrden('az')}
              title={t('lista.ordenarAZ')}
              aria-label={t('lista.ordenarAZ')}
              aria-pressed={orden === 'az'}
            >
              AZ
            </button>
            <button
              className={`sort-button${soloFavoritas ? ' sort-button--active' : ''}`}
              onClick={() => setSoloFavoritas((v) => !v)}
              title={t('fav.filtro')}
              aria-label={t('fav.filtro')}
              aria-pressed={soloFavoritas}
            >
              <IonIcon icon={starOutline} aria-hidden="true" />
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="search-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={s.codigo}
                  className={`search-suggestion-item${i === activeIdx ? ' search-suggestion-item--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={() => {
                    if (blurTimeout.current) clearTimeout(blurTimeout.current);
                    selectSuggestion(s.nombre);
                  }}
                >
                  <span className="suggestion-name">{s.nombre}</span>
                  <span className="suggestion-municipio">{s.municipio}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Local data (backend unavailable) */}
        {esFallback && (
          <div className="home-fallback" role="status">
            <p style={{ margin: 0 }}>{t('lista.datosLocales')}</p>
          </div>
        )}

        {datosNoDisponibles && (
          <div className="home-fallback" role="alert">
            <p style={{ margin: 0 }}>{t('lista.datosNoDisponibles')}</p>
          </div>
        )}

        {/* Loading state */}
        {!playas && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
            <span className="home-loading-text">{t('lista.cargando')}</span>
          </div>
        )}

        {/* Beach count */}
        {playas && !datosNoDisponibles && (
          <div className="beach-count">
            {tPlural('lista.contador', filtradas.length)}
            {filtro && ` ${t('lista.paraFiltro', { filtro })}`}
          </div>
        )}

        {/* Beach list */}
        {playas && filtradas.length > 0 && (
          <div className="beach-list">
            {filtradas.map((playa) => {
              const weather = weatherMap.get(playa.codigo);
              const skyEmoji = weather ? emojiCielo(weather.descripcionClima) : null;
              const distKm = userLocation
                ? haversineKm(userLocation[0], userLocation[1], playa.lat, playa.lon)
                : null;
              return (
              <div
                key={playa.codigo}
                className="beach-card"
                onClick={() => history.push(rutaPlaya(playa))}
                role="link"
                tabIndex={0}
                aria-label={t('comun.verDetalleDe', { nombre: `${playa.nombre}, ${playa.municipio}` })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push(rutaPlaya(playa));
                  }
                }}
              >
                <div className="beach-card-icon" aria-hidden="true">
                  {skyEmoji && <span className="beach-card-sky">{skyEmoji}</span>}
                  {weather?.temperatura != null && (
                    <span className="beach-card-temp">{Math.round(weather.temperatura)}{'°'}</span>
                  )}
                </div>
                <div className="beach-card-info">
                  <p className="beach-card-name">{playa.nombre}</p>
                  <p className="beach-card-municipio">
                    {playa.municipio}
                    {distKm != null && (
                      <span className="beach-card-dist">
                        {' · '}
                        {t('comun.aKm', { km: Math.round(distKm) })}
                      </span>
                    )}
                  </p>
                  {(() => {
                    const attrs = getActiveAttrs(playa.atributos).slice(0, 4);
                    return attrs.length > 0 ? (
                      <div className="beach-card-attrs">
                        {attrs.map((a) => (
                          <IonIcon
                            key={a.key}
                            className="beach-attr-mini"
                            icon={a.icon}
                            title={t(`attr.${a.key}` as ClaveTexto)}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {weather?.razonRanking && (
                    <p className="beach-card-reason">
                      {traducirTextoApi(
                        weather.pronostico
                          ? sinFragmentoDePronostico(razonLegible(weather.razonRanking))
                          : razonLegible(weather.razonRanking),
                        idioma,
                      )}
                    </p>
                  )}
                  <TrendBadge pronostico={weather?.pronostico} />
                </div>
                {weather && <ScoreBadge puntuacion={weather.puntuacion} />}
                {(() => {
                  const vigilada = vigilanciaDisponible(playa);
                  // Named by the beach's own operator: a region without
                  // Cruz Roja must not be labelled with somebody else's badge.
                  const operador = operadorVigilancia(playa);
                  const conWebcam = webcamDisponible(playa.webcam);
                  return vigilada || conWebcam ? (
                    <div className="beach-card-badges">
                      {vigilada && operador && (
                        <span
                          className="badge-vigilada"
                          aria-label={t('lista.vigiladaAria', {
                            operador: traducirOperador(operador, idioma),
                          })}
                        >
                          <span className="badge-vigilada-dot" aria-hidden="true" />
                          {traducirOperador(operador, idioma)}
                        </span>
                      )}
                      {conWebcam && (
                        <span className="badge-webcam" aria-label={t('lista.webcamAria')}>
                          <IonIcon icon={videocamOutline} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  ) : null;
                })()}
                <FavoriteButton
                  codigo={playa.codigo}
                  nombre={playa.nombre}
                  className="beach-card-fav"
                />
                <span className="beach-card-arrow" aria-hidden="true">&#8250;</span>
              </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {playas && !datosNoDisponibles && filtradas.length === 0 && (
          <div className="home-empty">
            <p className="home-empty-text">
              {/* Without a search term, an empty favorites view means "you have
                  not saved anything (visible) yet" — tell the user how, instead
                  of a false "no results". */}
              {soloFavoritas && !filtro
                ? t('fav.vacio')
                : t('lista.noEncontradas', { filtro })}
            </p>
          </div>
        )}

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayasList;
