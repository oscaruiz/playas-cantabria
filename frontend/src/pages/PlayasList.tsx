import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
} from '@ionic/react';
import { Playa, FeaturedBeach, getPlayas, getFeaturedBeaches } from '../services/api';
import { getActiveAttrs, emojiCielo } from '../utils/beachHelpers';
import { useUserLocation } from '../hooks/useUserLocation';
import BottomNavBar from '../components/BottomNavBar';
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
  const [error, setError] = useState<string | null>(null);
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
      .catch((err: Error) => setError(err.message));

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
        <h1 className="home-sticky-title">Playas de Cantabria</h1>
        <p className="home-sticky-subtitle">Consulta el estado de las playas</p>
      </div>

      <IonContent fullscreen>
        {/* Hero header spacer */}
        <div className="home-hero">
          <div className="home-hero-spacer" />
        </div>

        {/* Search bar */}
        <div className="search-bar-container">
          <div className="search-bar-inner">
            <span className="search-icon" aria-hidden="true">&#x1F50D;</span>
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
              placeholder="Buscar playa o municipio..."
              aria-label="Buscar playa o municipio"
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
                aria-label="Borrar búsqueda"
                type="button"
              >
                &times;
              </button>
            )}
            {userLocation && (
              <button
                className={`sort-button${orden === 'cerca' ? ' sort-button--active' : ''}`}
                onClick={() => setOrden('cerca')}
                title={'Ordenar por cercan\u00EDa'}
                aria-label={'Ordenar por cercan\u00EDa'}
                aria-pressed={orden === 'cerca'}
              >
                {'\u{1F4CD}'}
              </button>
            )}
            <button
              className={`sort-button${orden === 'az' ? ' sort-button--active' : ''}`}
              onClick={() => setOrden('az')}
              title="Ordenar A-Z"
              aria-label="Ordenar A-Z"
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
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {!playas && !error && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
            <span className="home-loading-text">Cargando playas...</span>
          </div>
        )}

        {/* Beach count */}
        {playas && (
          <div className="beach-count">
            {filtradas.length} {filtradas.length === 1 ? 'playa' : 'playas'}
            {filtro && ` para "${filtro}"`}
          </div>
        )}

        {/* Beach list */}
        {playas && filtradas.length > 0 && (
          <div className="beach-list">
            {filtradas.map((playa) => {
              const weather = weatherMap.get(playa.codigo);
              const skyEmoji = weather ? emojiCielo(weather.descripcionClima) : '\u{1F3D6}';
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
                aria-label={`Ver detalle de ${playa.nombre}, ${playa.municipio}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push(`/playas/${playa.codigo}`);
                  }
                }}
              >
                <div className="beach-card-icon" aria-hidden="true">
                  {skyEmoji}
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
                          <span key={a.key} className="beach-attr-mini" title={a.label}>
                            {a.emoji}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                {playa.idCruzRoja !== 0 && playa.idCruzRoja !== undefined && (
                  <div className="beach-card-badges">
                    <span className="badge-vigilada" aria-label="Playa vigilada por Cruz Roja">
                      <span className="badge-vigilada-dot" aria-hidden="true" />
                      Cruz Roja
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
            <div className="home-empty-icon" aria-hidden="true">{'\u{1F3D6}'}</div>
            <p className="home-empty-text">
              No se encontraron playas para &quot;{filtro}&quot;
            </p>
          </div>
        )}

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayasList;
