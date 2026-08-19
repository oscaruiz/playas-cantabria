import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { searchOutline, locateOutline, starOutline, videocamOutline } from 'ionicons/icons';
import { Playa, FeaturedBeach, getPlayas, getFeaturedBeaches } from '../services/api';
import { coincidePlaya, normalizarBusqueda, webcamDisponible } from '../utils/beachHelpers';
import { haversineKm } from '../shared/geo/haversine';
import { useUserLocation } from '../hooks/useUserLocation';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import { useHistory } from 'react-router-dom';
import BeachCard from '../components/BeachCard';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import LogoMarca from '../shared/ui/LogoMarca';
import { useFavoritas } from '../modules/favorites';
import { resumenMunicipios } from '../shared/seo/landings';
import SeoHead from '../shared/seo/SeoHead';
import './PlayasList.css';

/** A search suggestion: a municipality (navigates) or a beach (filters). */
type Sugerencia =
  | { tipo: 'municipio'; municipio: string; ruta: string; total: number }
  | { tipo: 'playa'; playa: Playa };

type OrdenMode = 'az' | 'cerca';

const PlayasList: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  const [weatherMap, setWeatherMap] = useState<Map<string, FeaturedBeach>>(new Map());
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<OrdenMode>('az');
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [soloConWebcam, setSoloConWebcam] = useState(false);
  const { favoritas } = useFavoritas();
  // There is no error state: `getPlayas` never rejects, it always falls back to the local
  // JSON. What does need to be conveyed is that the data is not fresh.
  const [esFallback, setEsFallback] = useState(false);
  const [datosNoDisponibles, setDatosNoDisponibles] = useState(false);
  const { t, tPlural } = useIdioma();
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

  const suggestions = useMemo<Sugerencia[]>(() => {
    if (!playas || filtro.length < 2) return [];
    const termino = normalizarBusqueda(filtro);
    // Municipalities first (they are the broader answer), max 2, then
    // beaches up to the usual 5 total.
    const municipios = (resumenMunicipios(playas) as Array<{
      municipio: string;
      ruta: string;
      total: number;
    }>)
      .filter((m) => normalizarBusqueda(m.municipio).includes(termino))
      .slice(0, 2)
      .map((m): Sugerencia => ({ tipo: 'municipio', ...m }));
    const dePlaya = playas
      .filter((p) => coincidePlaya(p, filtro))
      .slice(0, 5 - municipios.length)
      .map((p): Sugerencia => ({ tipo: 'playa', playa: p }));
    return [...municipios, ...dePlaya];
  }, [playas, filtro]);

  const selectSuggestion = useCallback((sugerencia: Sugerencia) => {
    if (sugerencia.tipo === 'municipio') {
      // A municipality is a destination, not a filter: go to its page.
      history.push(sugerencia.ruta);
    } else {
      setFiltro(sugerencia.playa.nombre);
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

  const filtradas = useMemo(() => {
    if (!playas) return [];
    const result = playas.filter(
      (p) =>
        (!soloFavoritas || favoritas.has(p.codigo)) &&
        (!soloConWebcam || webcamDisponible(p.webcam)) &&
        coincidePlaya(p, filtro)
    );
    if (orden === 'cerca' && userLocation) {
      const [uLat, uLon] = userLocation;
      return result.sort((a, b) =>
        haversineKm(uLat, uLon, a.lat, a.lon) - haversineKm(uLat, uLon, b.lat, b.lon)
      );
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [playas, filtro, orden, userLocation, soloFavoritas, favoritas, soloConWebcam]);

  return (
    <IonPage className="home-page">
      <SeoHead
        titulo={t('seo.tituloLista')}
        descripcion={t('seo.descLista')}
        rutaCanonica="/playas"
      />
      {/* Sticky header */}
      {/* Recargar al tocar el encabezado, pero SOLO sobre el título: cuando el
          manejador estaba en el contenedor, el clic en la ⓘ y en el selector
          de idioma burbujeaba hasta aquí y recargaba la página en vez de
          abrir el menú. `.header-actions` va en absoluto, así que envolver el
          texto no mueve nada. */}
      <div className="home-sticky-header">
        <div
          className="home-sticky-marca marca-con-logo"
          onClick={() => window.location.reload()}
          style={{ cursor: 'pointer' }}
        >
          <LogoMarca />
          <div className="marca-texto">
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
              aria-controls="sugerencias-lista"
              aria-activedescendant={
                showSuggestions && activeIdx >= 0 ? `sugerencia-${activeIdx}` : undefined
              }
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
            <button
              className={`sort-button${soloConWebcam ? ' sort-button--active' : ''}`}
              onClick={() => setSoloConWebcam((v) => !v)}
              title={t('lista.filtroWebcam')}
              aria-label={t('lista.filtroWebcam')}
              aria-pressed={soloConWebcam}
            >
              <IonIcon icon={videocamOutline} aria-hidden="true" />
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="search-suggestions" role="listbox" id="sugerencias-lista">
              {suggestions.map((s, i) => (
                <li
                  key={s.tipo === 'municipio' ? `municipio-${s.ruta}` : s.playa.codigo}
                  id={`sugerencia-${i}`}
                  className={`search-suggestion-item${i === activeIdx ? ' search-suggestion-item--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={() => {
                    if (blurTimeout.current) clearTimeout(blurTimeout.current);
                    selectSuggestion(s);
                  }}
                >
                  {s.tipo === 'municipio' ? (
                    <>
                      <span className="suggestion-name">{s.municipio}</span>
                      <span className="suggestion-municipio">
                        {t('detalle.municipio')} · {tPlural('lista.contador', s.total)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="suggestion-name">{s.playa.nombre}</span>
                      <span className="suggestion-municipio">{s.playa.municipio}</span>
                    </>
                  )}
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

        {/* Beach list — the shared BeachCard, same row as municipality and
            landing pages. */}
        {playas && filtradas.length > 0 && (
          <div className="beach-list">
            {filtradas.map((playa) => (
              <BeachCard
                key={playa.codigo}
                playa={playa}
                weather={weatherMap.get(playa.codigo)}
                distKm={
                  userLocation
                    ? haversineKm(userLocation[0], userLocation[1], playa.lat, playa.lon)
                    : null
                }
              />
            ))}
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
