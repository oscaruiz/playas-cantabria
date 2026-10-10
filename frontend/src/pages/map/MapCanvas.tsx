import { IonIcon, IonSpinner, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { videocamOutline, locateOutline } from 'ionicons/icons';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { Map as LeafletMap, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Beach, FeaturedBeach } from '../../services/api';
import {
  rankedSkyEmoji,
  isNightAt,
  skyWord,
  flagColorClass,
  webcamAvailable,
  lifeguardAvailable,
  lifeguardOperator,
} from '../../utils/beachHelpers';
import { useLanguage } from '../../shared/i18n/LanguageContext';
import {
  translateApiText,
  windLevelKey,
  flagKey,
  translateOperator,
  noForecastFragment,
} from '../../shared/i18n/apiText';
import TrendBadge from '../../components/TrendBadge';
import { REGION } from '../../shared/config/region';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useHistory, useLocation } from 'react-router-dom';
import { beachPath } from '../../shared/seo/beachUrls';

/**
 * Everything Leaflet, split OUT of the initial bundle: this module is
 * loaded with React.lazy from inside MapPage — the App.tsx rule ("to
 * split the bundle, do it INSIDE a page") — because Leaflet is the
 * heaviest dependency in the app and only this route needs it.
 */

// ---- Marker helpers ----

function markerStatus(score: number): 'good' | 'medium' | 'bad' {
  if (score >= 60) return 'good';
  if (score >= 35) return 'medium';
  return 'bad';
}

function secondaryBadge(weather: FeaturedBeach): string {
  if (weather.bandera === 'Roja') return '!';
  if (weather.vientoMs != null && weather.vientoMs > 8) return '!';
  return '';
}

function getBeachIcon(weather: FeaturedBeach, isBest: boolean): DivIcon {
  const status = markerStatus(weather.puntuacion);
  const sky = rankedSkyEmoji(weather);
  const temp = weather.temperatura != null ? `${Math.round(weather.temperatura)}°` : '';
  const badge = secondaryBadge(weather);
  const flag = weather.bandera ? flagColorClass(weather.bandera) : '';
  const highlight = isBest;
  const sizeClass = highlight ? ' beach-marker--highlight' : '';
  const bestClass = isBest ? ' beach-marker--best' : '';
  const size = highlight ? 52 : 44;

  const html = `<div class="beach-marker beach-marker--${status}${sizeClass}${bestClass}">
    <span class="beach-marker__sky">${sky}</span>
    <span class="beach-marker__temp">${temp}</span>
    ${flag && flag !== 'unknown' ? `<span class="map-pennant map-pennant--${flag} beach-marker__pennant"></span>` : ''}
    ${badge ? `<span class="beach-marker__badge">${badge}</span>` : ''}
  </div>`;

  return new L.DivIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function getFallbackIcon(num: number): DivIcon {
  return new L.DivIcon({
    html: `<div class="fallback-marker">${num}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

// ---- Component ----

const MapCanvas: React.FC<{
  beaches: Beach[];
  weatherMap: Map<string, FeaturedBeach>;
}> = ({ beaches, weatherMap }) => {
  const { userLocation, locationLoading, locationDenied, retryLocation } = useUserLocation();
  const [locateRequested, setLocateRequested] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const history = useHistory();
  const location = useLocation();
  const { t, language } = useLanguage();

  const userIcon = useMemo(() => new L.DivIcon({
    html: '<div class="user-marker"><span class="user-marker-dot"></span></div>',
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }), []);

  // Best beach = highest score
  const bestBeachCode = useMemo(() => {
    let bestCode: string | null = null;
    let bestScore = -1;
    weatherMap.forEach((w) => {
      if (w.puntuacion > bestScore) {
        bestScore = w.puntuacion;
        bestCode = w.codigo;
      }
    });
    return bestCode;
  }, [weatherMap]);

  // Fly to beach from query params (?lat=...&lon=...&codigo=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lat = parseFloat(params.get('lat') || '');
    const lon = parseFloat(params.get('lon') || '');
    const code = params.get('codigo');
    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 14, { duration: 0.8 });
      if (code) {
        const marker = markersRef.current.get(code);
        if (marker) setTimeout(() => marker.openPopup(), 900);
      }
    }
  }, [location.search, beaches]);

  // When the location arrives after tapping "locate me", center the map on it.
  useEffect(() => {
    if (locateRequested && userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 14, { duration: 0.8 });
      setLocateRequested(false);
    }
  }, [locateRequested, userLocation]);

  // If the user denies the permission, stop waiting (for the button's spinner).
  useEffect(() => {
    if (locationDenied) setLocateRequested(false);
  }, [locationDenied]);

  const handleLocate = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 14, { duration: 0.8 });
    } else {
      setLocateRequested(true);
      retryLocation();
    }
  };

  useIonViewWillLeave(() => {
    if (mapRef.current) mapRef.current.closePopup();
  });

  useIonViewDidEnter(() => {
    if (mapRef.current) mapRef.current.invalidateSize();
  });

  return (
    <div id="map-container">
      <MapContainer
        center={[REGION.map.center.lat, REGION.map.center.lon]}
        zoom={REGION.map.zoom}
        scrollWheelZoom={true}
        className="leaflet-map"
        ref={(mapInstance) => {
          if (mapInstance) mapRef.current = mapInstance;
        }}
      >
        {/*
          Community tile server, under the OSMF tile usage policy: no {s}
          subdomains (deprecated, and pointless over HTTP/2), and attribution
          that must stay visible and linked to the copyright page. Anything
          bulk —prefetching areas, offline maps— goes to a commercial provider,
          not here.
        */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {beaches.map((beach, index) => {
          const weather = weatherMap.get(beach.codigo);
          const icon = weather
            ? getBeachIcon(weather, beach.codigo === bestBeachCode)
            : getFallbackIcon(index + 1);
          const isLifeguarded = lifeguardAvailable(beach);
          const operator = lifeguardOperator(beach);

          return (
            <Marker
              key={beach.codigo}
              position={[beach.lat!, beach.lon!]}
              icon={icon}
              ref={(ref) => { if (ref) markersRef.current.set(beach.codigo, ref); }}
            >
              <Popup>
                <div className="map-popup">
                  <h3 className="map-popup-title">{beach.nombre}</h3>
                  <p className="map-popup-row">
                    <strong>{t('mapa.municipio')}</strong> {beach.municipio}
                  </p>
                  {weather && (() => {
                    const status = markerStatus(weather.puntuacion);
                    // The trend chip says the same right below, so the
                    // fragment is removed from the text (see `TrendBadge`).
                    const noRepeat = (text: string) =>
                      weather.pronostico ? noForecastFragment(text) : text;
                    return (
                      <>
                        <p className="map-popup-row">
                          {rankedSkyEmoji(weather)}{' '}
                          {weather.temperatura != null ? `${Math.round(weather.temperatura)}°` : ''}{' '}
                          {/* The app's own wording: here the provider's raw string
                              ("nubes dispersas") used to show while the
                              home page and the detail said "Parcialmente soleado". */}
                          {translateApiText(
                            skyWord(weather.descripcionClima, isNightAt(weather))
                              ?? weather.descripcionClima,
                            language,
                          )}{weather.climaPrevisto ? ` · ${t('cielo.previsto')}` : ''}{weather.vientoMs != null ? `, ${t(windLevelKey(weather.vientoMs))}` : ''}
                        </p>
                        {status === 'good' && (
                          <p className="map-popup-status map-popup-status--good">
                            {translateApiText(noRepeat(weather.razonRanking), language)}
                          </p>
                        )}
                        {status === 'medium' && weather.motivoBaja && (
                          <p className="map-popup-status map-popup-status--medium">
                            {translateApiText(noRepeat(weather.motivoBaja), language)}
                          </p>
                        )}
                        {status === 'bad' && weather.motivoBaja && (
                          <p className="map-popup-status map-popup-status--bad">
                            {translateApiText(noRepeat(weather.motivoBaja), language)}
                          </p>
                        )}
                        {/* On opening the beach: where it is heading and why. */}
                        <TrendBadge outlook={weather.pronostico} />
                        {weather.bandera && (
                          <p className="map-popup-flag">
                            <span className={`map-pennant map-pennant--${flagColorClass(weather.bandera)}`} aria-hidden="true" />
                            <span className="map-popup-flag-label">{t(flagKey(weather.bandera))}</span>
                          </p>
                        )}
                        {weather.vientoMs != null && weather.vientoMs > 8 && (
                          <p className="map-popup-status map-popup-status--bad">
                            {t('mapa.vientoFuerteKmh', { kmh: Math.round(weather.vientoMs * 3.6) })}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <p className="map-popup-row map-popup-muted">
                    {isLifeguarded && operator
                      ? t('mapa.vigilada', { operador: translateOperator(operator, language) })
                      // null = the backend says nobody watches it; absent =
                      // it does not report the operator. Collapsing both
                      // into "no info" hid a fact we do know.
                      : beach.fuenteBanderas === null
                        ? t('mapa.sinVigilancia')
                        : t('mapa.sinInfoCruzRoja')}
                  </p>
                  {webcamAvailable(beach.webcam) && (
                    <p className="map-popup-row map-popup-webcam">
                      <IonIcon icon={videocamOutline} aria-hidden="true" />
                      {t('mapa.webcamDisponible')}
                    </p>
                  )}
                  <button
                    className="map-popup-btn"
                    onClick={() => history.push(beachPath(beach))}
                  >
                    {t('mapa.verDetalles')}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>{t('mapa.tuUbicacion')}</Popup>
          </Marker>
        )}
      </MapContainer>

      <button
        type="button"
        className={`map-locate-btn${locationDenied ? ' map-locate-btn--denied' : ''}`}
        onClick={handleLocate}
        aria-label={t('mapa.localizarme')}
        title={t('mapa.localizarme')}
      >
        {locateRequested && locationLoading ? (
          <IonSpinner name="crescent" />
        ) : (
          <IonIcon icon={locateOutline} aria-hidden="true" />
        )}
      </button>

      <div className="map-legend">
        <span className="map-legend-item">
          <span className="map-legend-dot map-legend-dot--good" aria-hidden="true" /> {t('mapa.leyendaBuenas')}
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot map-legend-dot--medium" aria-hidden="true" /> {t('mapa.leyendaRegular')}
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot map-legend-dot--bad" aria-hidden="true" /> {t('mapa.leyendaMalas')}
        </span>
        <span className="map-legend-item map-legend-item--flag">
          <span className="map-pennant map-pennant--green" aria-hidden="true" /> {t('mapa.leyendaBandera')}
        </span>
      </div>
    </div>
  );
};

export default MapCanvas;
