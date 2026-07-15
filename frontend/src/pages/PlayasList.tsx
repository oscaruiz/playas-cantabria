import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { searchOutline, locateOutline } from 'ionicons/icons';
import { Playa, FeaturedBeach, getPlayas, getFeaturedBeaches } from '../services/api';
import { getActiveAttrs, emojiCielo } from '../utils/beachHelpers';
import { useUserLocation } from '../hooks/useUserLocation';
import { useIdioma } from '../i18n/IdiomaContext';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import { useHistory } from 'react-router-dom';
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
  const [error, setError] = useState(false);
  const { t, tPlural } = useIdioma();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const { userLocation } = useUserLocation();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useHistory();

  useEffect(() => {
    getPlayas({
      onBackendData: (data) => setPlayas(data),
    })
      .then(setPlayas)
      .catch(() => setError(true));

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
    const f = filtro.toLowerCase();
    return playas
      .filter((p) => p.nombre.toLowerCase().includes(f) || p.municipio.toLowerCase().includes(f))
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
    const f = filtro.toLowerCase();
    const result = playas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(f) || p.municipio.toLowerCase().includes(f)
    );
    if (orden === 'cerca' && userLocation) {
      const [uLat, uLon] = userLocation;
      return result.sort((a, b) =>
        haversineKm(uLat, uLon, a.lat, a.lon) - haversineKm(uLat, uLon, b.lat, b.lon)
      );
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [playas, filtro, orden, userLocation]);

  return (
    <IonPage className="home-page">
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

        {/* Error state */}
        {error && (
          <div className="home-error">
            <p style={{ margin: 0 }}>{t('lista.errorCarga')}</p>
          </div>
        )}

        {/* Loading state */}
        {!playas && !error && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
            <span className="home-loading-text">{t('lista.cargando')}</span>
          </div>
        )}

        {/* Beach count */}
        {playas && (
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
                onClick={() => history.push(`/playas/${playa.codigo}`)}
                role="link"
                tabIndex={0}
                aria-label={t('comun.verDetalleDe', { nombre: `${playa.nombre}, ${playa.municipio}` })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push(`/playas/${playa.codigo}`);
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
                      <span className="beach-card-dist"> &middot; a {Math.round(distKm)} km</span>
                    )}
                  </p>
                  {(() => {
                    const attrs = getActiveAttrs(playa.atributos).slice(0, 4);
                    return attrs.length > 0 ? (
                      <div className="beach-card-attrs">
                        {attrs.map((a) => (
                          <IonIcon key={a.key} className="beach-attr-mini" icon={a.icon} title={a.label} aria-hidden="true" />
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                {playa.idCruzRoja !== 0 && playa.idCruzRoja !== undefined && (
                  <div className="beach-card-badges">
                    <span className="badge-vigilada" aria-label={t('lista.vigiladaAria')}>
                      <span className="badge-vigilada-dot" aria-hidden="true" />
                      {t('comun.cruzRoja')}
                    </span>
                  </div>
                )}
                <span className="beach-card-arrow" aria-hidden="true">&#8250;</span>
              </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {playas && filtradas.length === 0 && (
          <div className="home-empty">
            <p className="home-empty-text">
              {t('lista.noEncontradas', { filtro })}
            </p>
          </div>
        )}

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayasList;
