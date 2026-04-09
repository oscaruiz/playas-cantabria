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
import { emojiCielo } from '../utils/beachHelpers';
import { useUserLocation } from '../hooks/useUserLocation';
import BottomNavBar from '../components/BottomNavBar';
import { useHistory, useLocation } from 'react-router-dom';
import './MapaPage.css';

// ---- Marker helpers ----

function markerStatus(score: number): 'good' | 'medium' | 'bad' {
  if (score >= 60) return 'good';
  if (score >= 35) return 'medium';
  return 'bad';
}

function secondaryBadge(weather: FeaturedBeach): string {
  if (weather.bandera === 'Roja') return '\u26A0\uFE0F';
  if (weather.vientoMs != null && weather.vientoMs > 8) return '\u{1F4A8}';
  return '';
}

function getBeachIcon(weather: FeaturedBeach, isBest: boolean): DivIcon {
  const status = markerStatus(weather.puntuacion);
  const sky = emojiCielo(weather.descripcionClima);
  const temp = weather.temperatura != null ? `${Math.round(weather.temperatura)}\u00B0` : '';
  const badge = secondaryBadge(weather);
  const highlight = isBest;
  const sizeClass = highlight ? ' beach-marker--highlight' : '';
  const bestClass = isBest ? ' beach-marker--best' : '';
  const size = highlight ? 52 : 44;

  const html = `<div class="beach-marker beach-marker--${status}${sizeClass}${bestClass}">
    <span class="beach-marker__sky">${sky}</span>
    <span class="beach-marker__temp">${temp}</span>
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
    html: `<div style="background-color:#3880ff;color:white;font-weight:bold;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${numero}</div>`,
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

  const userIcon = useMemo(() => new L.DivIcon({
    html: `<div style="
      background-color:#3880ff;
      color:white;
      font-weight:bold;
      border-radius:50%;
      width:40px;
      height:40px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
    ">\u{1F4CD}</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
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
        <h1 className="mapa-sticky-title">Playas de Cantabria</h1>
        <p className="mapa-sticky-subtitle">Explora las playas en el mapa</p>
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
                    <div style={{ minWidth: '180px' }}>
                      <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>
                        {'\u{1F3D6}'} {playa.nombre}
                      </h3>
                      <p style={{ margin: '0 0 4px' }}>
                        <strong>Municipio:</strong> {playa.municipio}
                      </p>
                      {weather && (() => {
                        const status = markerStatus(weather.puntuacion);
                        return (
                          <>
                            <p style={{ margin: '0 0 4px' }}>
                              {emojiCielo(weather.descripcionClima)}{' '}
                              {weather.temperatura != null ? `${Math.round(weather.temperatura)}\u00B0` : ''}{' '}
                              {weather.descripcionClima}{weather.vientoMs != null ? `, ${weather.vientoMs < 3 ? 'sin viento' : weather.vientoMs < 6 ? 'brisa suave' : weather.vientoMs < 10 ? 'viento moderado' : 'viento fuerte'}` : ''}
                            </p>
                            {status === 'good' && (
                              <p style={{ margin: '0 0 4px', color: '#16a34a', fontSize: '12px' }}>
                                {'\u2705'} {weather.razonRanking}
                              </p>
                            )}
                            {status === 'medium' && weather.motivoBaja && (
                              <p style={{ margin: '0 0 4px', color: '#b45309', fontSize: '12px' }}>
                                {'\u26A0\uFE0F'} {weather.motivoBaja}
                              </p>
                            )}
                            {status === 'bad' && weather.motivoBaja && (
                              <p style={{ margin: '0 0 4px', color: '#dc2626', fontSize: '12px' }}>
                                {'\u26D4'} {weather.motivoBaja}
                              </p>
                            )}
                            {weather.bandera === 'Roja' && (
                              <p style={{ margin: '0 0 4px', color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                                {'\u26A0\uFE0F'} Bandera roja
                              </p>
                            )}
                            {weather.vientoMs != null && weather.vientoMs > 8 && (
                              <p style={{ margin: '0 0 4px', color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                                {'\u{1F4A8}'} Viento fuerte ({Math.round(weather.vientoMs * 3.6)} km/h)
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <p style={{ margin: '0 0 6px' }}>
                        {isVigilada
                          ? '\u{1F6DF} Vigilada por Cruz Roja'
                          : '\u{1F6AB} No hay info de Cruz Roja'}
                      </p>
                      <button
                        onClick={() => history.push(`/playas/${playa.codigo}`)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 10px',
                          backgroundColor: '#3880ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        Ver detalles
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {userLocation && (
              <Marker position={userLocation} icon={userIcon}>
                <Popup>{'\u{1F4CD}'} Tu ubicaci{'ó'}n actual</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MapaPage;
