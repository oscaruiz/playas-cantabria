import {
  IonPage,
  IonContent,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { Map as LeafletMap, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Playa, getPlayas } from '../services/api';
import BottomNavBar from '../components/BottomNavBar';
import { useHistory } from 'react-router-dom';
import './MapaPage.css';

const MapaPage: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const history = useHistory();

  // Icono de texto numerado
  const getTextIcon = (numero: number): DivIcon =>
    new L.DivIcon({
      html: `<div style="background-color:#3880ff;color:white;font-weight:bold;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${numero}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

  // Icono ubicación usuario
  const userIcon = new L.DivIcon({
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
    ">📍</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });

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
        .sort((a, b) => a.lon - b.lon); // Oeste a este
      setPlayas(validas);
    };

    // Cargar playas y ordenarlas de oeste a este
    getPlayas({ onBackendData: handlePlayas }).then(handlePlayas);

    // Obtener ubicación del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.warn('No se pudo obtener ubicación del usuario', err);
        }
      );
    }
  }, []);

  useIonViewWillLeave(() => {
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
  });

  useIonViewDidEnter(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  });

  return (
    <IonPage className="mapa-page">
      <div className="mapa-sticky-header">
        <h1 className="mapa-sticky-title">Playas de Cantabria</h1>
      </div>

      <IonContent className="mapa-content">
        <div id="mapa-container">
          <MapContainer
            center={[43.4, -4.05]} // Centro Cantabria
            zoom={9}
            scrollWheelZoom={true}
            className="leaflet-map"
            ref={(mapInstance) => {
              if (mapInstance) {
                mapRef.current = mapInstance;
              }
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Playa markers */}
            {playas.map((playa, index) => {
              const isVigilada = playa.idCruzRoja && playa.idCruzRoja > 0;

              return (
                <Marker
                  key={playa.codigo}
                  position={[playa.lat!, playa.lon!]}
                  icon={getTextIcon(index + 1)}
                >
                  <Popup>
                    <div style={{ minWidth: '180px' }}>
                      <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>
                        🏖 {playa.nombre}
                      </h3>
                      <p style={{ margin: '0' }}>
                        <strong>Municipio:</strong> {playa.municipio}
                      </p>
                      {isVigilada
                        ? '🛟 Vigilada por Cruz Roja'
                        : '🚫 No hay info de Cruz Roja'}
                      <button
                        onClick={() => history.push(`/playas/${playa.codigo}`)}
                        style={{
                          marginTop: '8px',
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

            {/* User location marker */}
            {userLocation && (
              <Marker position={userLocation} icon={userIcon}>
                <Popup>📍 Tu ubicación actual</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
        <BottomNavBar currentTab="mapa" />
      </IonContent>
    </IonPage>
  );
};

export default MapaPage;
