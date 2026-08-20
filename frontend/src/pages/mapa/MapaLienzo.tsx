import { IonIcon, IonSpinner, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { videocamOutline, locateOutline } from 'ionicons/icons';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { Map as LeafletMap, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Playa, FeaturedBeach } from '../../services/api';
import {
  rankedSkyEmoji,
  esNocheEn,
  palabraCielo,
  flagColorClass,
  webcamDisponible,
  vigilanciaDisponible,
  operadorVigilancia,
} from '../../utils/beachHelpers';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import {
  traducirTextoApi,
  claveNivelVientoMs,
  claveBandera,
  traducirOperador,
  sinFragmentoDePronostico,
} from '../../shared/i18n/apiText';
import TrendBadge from '../../components/TrendBadge';
import { REGION } from '../../shared/config/region';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useHistory, useLocation } from 'react-router-dom';
import { rutaPlaya } from '../../shared/seo/beachUrls';

/**
 * Everything Leaflet, split OUT of the initial bundle: this module is
 * loaded with React.lazy from inside MapaPage — the App.tsx rule ("to
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
    ${flag && flag !== 'unknown' ? `<span class="mapa-pennant mapa-pennant--${flag} beach-marker__pennant"></span>` : ''}
    ${badge ? `<span class="beach-marker__badge">${badge}</span>` : ''}
  </div>`;

  return new L.DivIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function getFallbackIcon(numero: number): DivIcon {
  return new L.DivIcon({
    html: `<div class="fallback-marker">${numero}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

// ---- Component ----

const MapaLienzo: React.FC<{
  playas: Playa[];
  weatherMap: Map<string, FeaturedBeach>;
}> = ({ playas, weatherMap }) => {
  const { userLocation, locationLoading, locationDenied, retryLocation } = useUserLocation();
  const [locateRequested, setLocateRequested] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const history = useHistory();
  const location = useLocation();
  const { t, idioma } = useIdioma();

  const userIcon = useMemo(() => new L.DivIcon({
    html: '<div class="user-marker"><span class="user-marker-dot"></span></div>',
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }), []);

  // Best beach = highest score
  const bestCodigo = useMemo(() => {
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
    const codigo = params.get('codigo');
    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 14, { duration: 0.8 });
      if (codigo) {
        const marker = markersRef.current.get(codigo);
        if (marker) setTimeout(() => marker.openPopup(), 900);
      }
    }
  }, [location.search, playas]);

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
    <div id="mapa-container">
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

        {playas.map((playa, index) => {
          const weather = weatherMap.get(playa.codigo);
          const icon = weather
            ? getBeachIcon(weather, playa.codigo === bestCodigo)
            : getFallbackIcon(index + 1);
          const isVigilada = vigilanciaDisponible(playa);
          const operador = operadorVigilancia(playa);

          return (
            <Marker
              key={playa.codigo}
              position={[playa.lat!, playa.lon!]}
              icon={icon}
              ref={(ref) => { if (ref) markersRef.current.set(playa.codigo, ref); }}
            >
              <Popup>
                <div className="mapa-popup">
                  <h3 className="mapa-popup-title">{playa.nombre}</h3>
                  <p className="mapa-popup-row">
                    <strong>{t('mapa.municipio')}</strong> {playa.municipio}
                  </p>
                  {weather && (() => {
                    const status = markerStatus(weather.puntuacion);
                    // El chip de tendencia dice lo mismo justo debajo, así
                    // que el fragmento sale del texto (ver `TrendBadge`).
                    const sinRepetir = (texto: string) =>
                      weather.pronostico ? sinFragmentoDePronostico(texto) : texto;
                    return (
                      <>
                        <p className="mapa-popup-row">
                          {rankedSkyEmoji(weather)}{' '}
                          {weather.temperatura != null ? `${Math.round(weather.temperatura)}°` : ''}{' '}
                          {/* La palabra de la app: aquí se leía la cadena cruda
                              del proveedor ("nubes dispersas") mientras la
                              portada y el detalle decían "Parcialmente soleado". */}
                          {traducirTextoApi(
                            palabraCielo(weather.descripcionClima, esNocheEn(weather))
                              ?? weather.descripcionClima,
                            idioma,
                          )}{weather.vientoMs != null ? `, ${t(claveNivelVientoMs(weather.vientoMs))}` : ''}
                        </p>
                        {status === 'good' && (
                          <p className="mapa-popup-status mapa-popup-status--good">
                            {traducirTextoApi(sinRepetir(weather.razonRanking), idioma)}
                          </p>
                        )}
                        {status === 'medium' && weather.motivoBaja && (
                          <p className="mapa-popup-status mapa-popup-status--medium">
                            {traducirTextoApi(sinRepetir(weather.motivoBaja), idioma)}
                          </p>
                        )}
                        {status === 'bad' && weather.motivoBaja && (
                          <p className="mapa-popup-status mapa-popup-status--bad">
                            {traducirTextoApi(sinRepetir(weather.motivoBaja), idioma)}
                          </p>
                        )}
                        {/* Al abrir la playa: hacia dónde va y por qué. */}
                        <TrendBadge pronostico={weather.pronostico} />
                        {weather.bandera && (
                          <p className="mapa-popup-flag">
                            <span className={`mapa-pennant mapa-pennant--${flagColorClass(weather.bandera)}`} aria-hidden="true" />
                            <span className="mapa-popup-flag-label">{t(claveBandera(weather.bandera))}</span>
                          </p>
                        )}
                        {weather.vientoMs != null && weather.vientoMs > 8 && (
                          <p className="mapa-popup-status mapa-popup-status--bad">
                            {t('mapa.vientoFuerteKmh', { kmh: Math.round(weather.vientoMs * 3.6) })}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <p className="mapa-popup-row mapa-popup-muted">
                    {isVigilada && operador
                      ? t('mapa.vigilada', { operador: traducirOperador(operador, idioma) })
                      // null = the backend says nobody watches it; absent =
                      // it does not report the operator. Collapsing both
                      // into "no info" hid a fact we do know.
                      : playa.fuenteBanderas === null
                        ? t('mapa.sinVigilancia')
                        : t('mapa.sinInfoCruzRoja')}
                  </p>
                  {webcamDisponible(playa.webcam) && (
                    <p className="mapa-popup-row mapa-popup-webcam">
                      <IonIcon icon={videocamOutline} aria-hidden="true" />
                      {t('mapa.webcamDisponible')}
                    </p>
                  )}
                  <button
                    className="mapa-popup-btn"
                    onClick={() => history.push(rutaPlaya(playa))}
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
        className={`mapa-locate-btn${locationDenied ? ' mapa-locate-btn--denied' : ''}`}
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

      <div className="mapa-leyenda">
        <span className="mapa-leyenda-item">
          <span className="mapa-leyenda-dot mapa-leyenda-dot--good" aria-hidden="true" /> {t('mapa.leyendaBuenas')}
        </span>
        <span className="mapa-leyenda-item">
          <span className="mapa-leyenda-dot mapa-leyenda-dot--medium" aria-hidden="true" /> {t('mapa.leyendaRegular')}
        </span>
        <span className="mapa-leyenda-item">
          <span className="mapa-leyenda-dot mapa-leyenda-dot--bad" aria-hidden="true" /> {t('mapa.leyendaMalas')}
        </span>
        <span className="mapa-leyenda-item mapa-leyenda-item--flag">
          <span className="mapa-pennant mapa-pennant--green" aria-hidden="true" /> {t('mapa.leyendaBandera')}
        </span>
      </div>
    </div>
  );
};

export default MapaLienzo;
