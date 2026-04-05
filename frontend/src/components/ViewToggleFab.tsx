import React from 'react';
import { IonIcon } from '@ionic/react';
import { mapOutline, listOutline } from 'ionicons/icons';
import './ViewToggleFab.css';

interface ViewToggleFabProps {
  isMapView: boolean;
  onClick: () => void;
}

const ViewToggleFab: React.FC<ViewToggleFabProps> = ({ isMapView, onClick }) => {
  const icon = isMapView ? listOutline : mapOutline;
  const label = isMapView ? 'Ver lista' : 'Ver mapa';

  return (
    <div className="view-toggle-fab-container">
      <button
        className="view-toggle-fab"
        onClick={onClick}
        aria-label={label}
      >
        <IonIcon icon={icon} />
        <span>{label}</span>
      </button>
    </div>
  );
};

export default ViewToggleFab;
