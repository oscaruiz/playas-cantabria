import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
} from '@ionic/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { Map as LeafletMap, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Playa, getPlayas } from '../services/api';
import { useHistory } from 'react-router-dom';
import './MapaPage.css';

const MapaPage: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[]>([]);
  const mapRef = useRef<LeafletMap | null>(null);
  const history = useHistory();

  useEffect(() => {
    getPlayas().then((data) => {
      const validas = data.filter(
        (p) =>
          typeof p.lat === 'number' &&
          typeof p.lon === 'number' &&
          p.lat !== 0 &&
          p.lon !== 0
      );
      setPlayas(validas);
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        console.log('🗺️ Mapa redimensionado con invalidateSize');
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const getTextIcon = (numero: number): DivIcon =>
    new L.DivIcon({
      html: `<div style="background-color:#3880ff;color:white;font-weight:bold;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${numero}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>
          <IonTitle>Mapa de Playas</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="mapa-content">
        <div id="mapa-container">
          <MapContainer
            center={[43.4, -4.05]} // Centro de Cantabria
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

            {playas.map((playa, index) => {
              const isVigilada = playa.idCruzRoja && playa.idCruzRoja > 0;

              console.log(
                `📌 Marcador: ${playa.nombre} (${playa.lat}, ${playa.lon}) - Vigilada: ${isVigilada}`
              );

              return (
                <Marker
                  key={playa.codigo}
                  position={[playa.lat!, playa.lon!]}
                  icon={getTextIcon(index + 1)} // 1, 2, 3...
                >
                  <Popup>
                    <div style={{ minWidth: '180px' }}>
                      <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>
                        🏖 {playa.nombre}
                      </h3>
                      <p style={{ margin: '0' }}>
                        <strong>Municipio:</strong> {playa.municipio}
                      </p>
 {isVigilada ? '🛟 Vigilada por Cruz Roja' : '🚫 No hay info de Cruz Roja'}

                      <button
                        onClick={() =>
                          history.push(`/playas/${playa.codigo}`)
                        }
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
          </MapContainer>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MapaPage;
