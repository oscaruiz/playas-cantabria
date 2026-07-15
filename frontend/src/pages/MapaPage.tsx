import {
  IonPage,
  IonContent,
  IonFooter,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { Map as LeafletMap, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Playa, FeaturedBeach, getPlayas, getFeaturedBeaches } from '../services/api';
import { emojiCielo, flagColorClass } from '../utils/beachHelpers';
import { useIdioma } from '../i18n/IdiomaContext';
import { traducirTextoApi, claveNivelVientoMs, claveBandera } from '../i18n/apiText';
import { useUserLocation } from '../hooks/useUserLocation';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import { useHistory, useLocation } from 'react-router-dom';
import './MapaPage.css';

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
  const sky = emojiCielo(weather.descripcionClima);
  const temp = weather.temperatura != null ? `${Math.round(weather.temperatura)}\u00B0` : '';
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

const MapaPage: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[]>([]);
  const [weatherMap, setWeatherMap] = useState<Map<string, FeaturedBeach>>(new Map());
  const { userLocation } = useUserLocation();
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

  useEffect(() => {
    const handlePlayas = (data: Playa[]) => {
      const validas = data
        .filter(
          (p) =>
            typeof p.lat === 'number' &&
            typeof p.lon === 'number' &&
            p.lat !== 0 &&
            p.lon !== 0
        )
        .sort((a, b) => a.lon - b.lon);
      setPlayas(validas);
    };

    getPlayas({ onBackendData: handlePlayas }).then(handlePlayas);

    getFeaturedBeaches()
      .then((res) => {
        const map = new Map<string, FeaturedBeach>();
        for (const b of res.resumenTodas) map.set(b.codigo, b);
        setWeatherMap(map);
      })
      .catch(() => { /* fallback: numbered markers */ });
  }, []);

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

  useIonViewWillLeave(() => {
    if (mapRef.current) mapRef.current.closePopup();
  });

  useIonViewDidEnter(() => {
    if (mapRef.current) mapRef.current.invalidateSize();
  });

  return (
    <IonPage className="mapa-page">
      <div className="mapa-sticky-header" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
        <h1 className="mapa-sticky-title">{t('app.titulo')}</h1>
        <p className="mapa-sticky-subtitle">{t('mapa.subtitulo')}</p>
        <SelectorIdioma />
      </div>

      <IonContent className="mapa-content">
        <div id="mapa-container">
          <MapContainer
            center={[43.4, -4.05]}
            zoom={9}
            scrollWheelZoom={true}
            className="leaflet-map"
            ref={(mapInstance) => {
              if (mapInstance) mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {playas.map((playa, index) => {
              const weather = weatherMap.get(playa.codigo);
              const icon = weather
                ? getBeachIcon(weather, playa.codigo === bestCodigo)
                : getFallbackIcon(index + 1);
              const isVigilada = playa.idCruzRoja && playa.idCruzRoja > 0;

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
                        return (
                          <>
                            <p className="mapa-popup-row">
                              {emojiCielo(weather.descripcionClima)}{' '}
                              {weather.temperatura != null ? `${Math.round(weather.temperatura)}\u00B0` : ''}{' '}
                              {traducirTextoApi(weather.descripcionClima, idioma)}{weather.vientoMs != null ? `, ${t(claveNivelVientoMs(weather.vientoMs))}` : ''}
                            </p>
                            {status === 'good' && (
                              <p className="mapa-popup-status mapa-popup-status--good">
                                {traducirTextoApi(weather.razonRanking, idioma)}
                              </p>
                            )}
                            {status === 'medium' && weather.motivoBaja && (
                              <p className="mapa-popup-status mapa-popup-status--medium">
                                {traducirTextoApi(weather.motivoBaja, idioma)}
                              </p>
                            )}
                            {status === 'bad' && weather.motivoBaja && (
                              <p className="mapa-popup-status mapa-popup-status--bad">
                                {traducirTextoApi(weather.motivoBaja, idioma)}
                              </p>
                            )}
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
                        {isVigilada ? t('mapa.vigilada') : t('mapa.sinInfoCruzRoja')}
                      </p>
                      <button
                        className="mapa-popup-btn"
                        onClick={() => history.push(`/playas/${playa.codigo}`)}
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
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MapaPage;
