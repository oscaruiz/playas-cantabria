import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { searchOutline, locateOutline, starOutline, videocamOutline } from 'ionicons/icons';
import { Beach } from '../services/api';
import { useRanking } from '../features/ranking/useRanking';
import { useBeaches } from '../features/catalog/useBeaches';
import { matchesBeach, normalizeSearch, webcamAvailable } from '../utils/beachHelpers';
import { haversineKm } from '../shared/geo/haversine';
import { useUserLocation } from '../hooks/useUserLocation';
import { useLanguage } from '../shared/i18n/LanguageContext';
import { useHistory } from 'react-router-dom';
import BeachCard from '../components/BeachCard';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import BrandLogo from '../shared/ui/BrandLogo';
import { useFavoriteCodes } from '../modules/favorites';
import { municipalitiesSummary } from '../shared/seo/landings';
import SeoHead from '../shared/seo/SeoHead';
import './BeachList.css';

/** A search suggestion: a municipality (navigates) or a beach (filters). */
type Suggestion =
  | { kind: 'municipio'; municipio: string; ruta: string; total: number }
  | { kind: 'playa'; beach: Beach };

type SortMode = 'az' | 'cerca';

const NO_BEACHES: Beach[] = [];

const BeachList: React.FC = () => {
  const catalog = useBeaches();
  const dataUnavailable = catalog.status === 'unavailable';
  const isFallback = catalog.status === 'ready' && catalog.source === 'fallback';
  // Unavailable is an empty catalog, not a spinner: there is nothing left to wait for.
  const beaches = catalog.status === 'ready' ? catalog.beaches : dataUnavailable ? NO_BEACHES : null;
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState<SortMode>('az');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyWithWebcam, setOnlyWithWebcam] = useState(false);
  const { favorites } = useFavoriteCodes();
  // There is no error state: `getBeaches` never rejects, it always falls back to the local
  // JSON. What does need to be conveyed is that the data is not fresh.
  const { t, tPlural } = useLanguage();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const { userLocation } = useUserLocation();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useHistory();

  // The list paints the same sky as the home page, so it reads the same
  // ranking in force.
  const { ranking } = useRanking();
  const weatherMap = useMemo(
    () => new Map((ranking?.resumenTodas ?? []).map((b) => [b.codigo, b])),
    [ranking],
  );

  // No toggle needed — two separate buttons

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!beaches || filter.length < 2) return [];
    const term = normalizeSearch(filter);
    // Municipalities first (they are the broader answer), max 2, then
    // beaches up to the usual 5 total.
    const municipalities = (municipalitiesSummary(beaches) as Array<{
      municipio: string;
      ruta: string;
      total: number;
    }>)
      .filter((m) => normalizeSearch(m.municipio).includes(term))
      .slice(0, 2)
      .map((m): Suggestion => ({ kind: 'municipio', ...m }));
    const forBeach = beaches
      .filter((p) => matchesBeach(p, filter))
      .slice(0, 5 - municipalities.length)
      .map((p): Suggestion => ({ kind: 'playa', beach: p }));
    return [...municipalities, ...forBeach];
  }, [beaches, filter]);

  const selectSuggestion = useCallback((suggestion: Suggestion) => {
    if (suggestion.kind === 'municipio') {
      // A municipality is a destination, not a filter: go to its page.
      history.push(suggestion.ruta);
    } else {
      setFilter(suggestion.beach.nombre);
    }
    setShowSuggestions(false);
    setActiveIdx(-1);
  }, [history]);

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
      selectSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIdx(-1);
    }
  }, [showSuggestions, suggestions, activeIdx, selectSuggestion]);

  const filtered = useMemo(() => {
    if (!beaches) return [];
    const result = beaches.filter(
      (p) =>
        (!onlyFavorites || favorites.has(p.codigo)) &&
        (!onlyWithWebcam || webcamAvailable(p.webcam)) &&
        matchesBeach(p, filter)
    );
    if (order === 'cerca' && userLocation) {
      const [uLat, uLon] = userLocation;
      return result.sort((a, b) =>
        haversineKm(uLat, uLon, a.lat, a.lon) - haversineKm(uLat, uLon, b.lat, b.lon)
      );
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [beaches, filter, order, userLocation, onlyFavorites, favorites, onlyWithWebcam]);

  return (
    <IonPage className="home-page">
      <SeoHead
        title={t('seo.tituloLista')}
        description={t('seo.descLista')}
        canonicalPath="/playas"
      />
      {/* Sticky header */}
      {/* Recargar al tocar el encabezado, pero SOLO sobre el título: cuando el
          manejador estaba en el contenedor, el clic en la ⓘ y en el selector
          de idioma burbujeaba hasta aquí y recargaba la página en vez de
          abrir el menú. `.header-actions` va en absoluto, así que envolver el
          texto no mueve nada. */}
      <div className="home-sticky-header">
        <div
          className="home-sticky-brand brand-with-logo"
          onClick={() => window.location.reload()}
          style={{ cursor: 'pointer' }}
        >
          <BrandLogo />
          <div className="brand-text">
            <h1 className="home-sticky-title">{t('app.titulo')}</h1>
            <p className="home-sticky-subtitle">{t('lista.subtitulo')}</p>
          </div>
        </div>
        <HeaderActions />
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
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setShowSuggestions(true);
                setActiveIdx(-1);
              }}
              onFocus={() => { if (filter.length >= 2) setShowSuggestions(true); }}
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
              aria-controls="suggestions-list"
              aria-activedescendant={
                showSuggestions && activeIdx >= 0 ? `suggestion-${activeIdx}` : undefined
              }
            />
            {filter.length > 0 && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setFilter('');
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
                className={`sort-button${order === 'cerca' ? ' sort-button--active' : ''}`}
                onClick={() => setOrder('cerca')}
                title={t('lista.ordenarCercania')}
                aria-label={t('lista.ordenarCercania')}
                aria-pressed={order === 'cerca'}
              >
                <IonIcon icon={locateOutline} aria-hidden="true" />
              </button>
            )}
            <button
              className={`sort-button${order === 'az' ? ' sort-button--active' : ''}`}
              onClick={() => setOrder('az')}
              title={t('lista.ordenarAZ')}
              aria-label={t('lista.ordenarAZ')}
              aria-pressed={order === 'az'}
            >
              AZ
            </button>
            <button
              className={`sort-button${onlyFavorites ? ' sort-button--active' : ''}`}
              onClick={() => setOnlyFavorites((v) => !v)}
              title={t('fav.filtro')}
              aria-label={t('fav.filtro')}
              aria-pressed={onlyFavorites}
            >
              <IonIcon icon={starOutline} aria-hidden="true" />
            </button>
            <button
              className={`sort-button${onlyWithWebcam ? ' sort-button--active' : ''}`}
              onClick={() => setOnlyWithWebcam((v) => !v)}
              title={t('lista.filtroWebcam')}
              aria-label={t('lista.filtroWebcam')}
              aria-pressed={onlyWithWebcam}
            >
              <IonIcon icon={videocamOutline} aria-hidden="true" />
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="search-suggestions" role="listbox" id="suggestions-list">
              {suggestions.map((s, i) => (
                <li
                  key={s.kind === 'municipio' ? `municipality-${s.ruta}` : s.beach.codigo}
                  id={`suggestion-${i}`}
                  className={`search-suggestion-item${i === activeIdx ? ' search-suggestion-item--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={() => {
                    if (blurTimeout.current) clearTimeout(blurTimeout.current);
                    selectSuggestion(s);
                  }}
                >
                  {s.kind === 'municipio' ? (
                    <>
                      <span className="suggestion-name">{s.municipio}</span>
                      <span className="suggestion-municipality">
                        {t('detalle.municipio')} · {tPlural('lista.contador', s.total)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="suggestion-name">{s.beach.nombre}</span>
                      <span className="suggestion-municipality">{s.beach.municipio}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Local data (backend unavailable) */}
        {isFallback && (
          <div className="home-fallback" role="status">
            <p style={{ margin: 0 }}>{t('lista.datosLocales')}</p>
          </div>
        )}

        {dataUnavailable && (
          <div className="home-fallback" role="alert">
            <p style={{ margin: 0 }}>{t('lista.datosNoDisponibles')}</p>
          </div>
        )}

        {/* Loading state */}
        {!beaches && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
            <span className="home-loading-text">{t('lista.cargando')}</span>
          </div>
        )}

        {/* Beach count */}
        {beaches && !dataUnavailable && (
          <div className="beach-count">
            {tPlural('lista.contador', filtered.length)}
            {filter && ` ${t('lista.paraFiltro', { filtro: filter })}`}
          </div>
        )}

        {/* Beach list — the shared BeachCard, same row as municipality and
            landing pages. */}
        {beaches && filtered.length > 0 && (
          <div className="beach-list">
            {filtered.map((beach) => (
              <BeachCard
                key={beach.codigo}
                beach={beach}
                weather={weatherMap.get(beach.codigo)}
                distKm={
                  userLocation
                    ? haversineKm(userLocation[0], userLocation[1], beach.lat, beach.lon)
                    : null
                }
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {beaches && !dataUnavailable && filtered.length === 0 && (
          <div className="home-empty">
            <p className="home-empty-text">
              {/* Without a search term, an empty favorites view means "you have
                  not saved anything (visible) yet" — tell the user how, instead
                  of a false "no results". */}
              {onlyFavorites && !filter
                ? t('fav.vacio')
                : t('lista.noEncontradas', { filtro: filter })}
            </p>
          </div>
        )}

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default BeachList;
