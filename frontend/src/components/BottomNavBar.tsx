import React from 'react';
import { IonIcon } from '@ionic/react';
import { homeOutline, listOutline, mapOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import './BottomNavBar.css';

function deriveTab(pathname: string): 'home' | 'lista' | 'mapa' {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/playas')) return 'lista';
  if (pathname.startsWith('/mapa')) return 'mapa';
  return 'home';
}

const BottomNavBar: React.FC = () => {
  const history = useHistory();
  const { pathname } = useLocation();
  const currentTab = deriveTab(pathname);

  return (
    <nav className="bottom-nav-bar" aria-label={'Navegaci\u00F3n principal'}>
      <button
        className={`bottom-nav-tab${currentTab === 'home' ? ' active' : ''}`}
        onClick={() => { if (currentTab !== 'home') history.push('/'); }}
        aria-current={currentTab === 'home' ? 'page' : undefined}
        aria-label="Inicio"
      >
        <IonIcon icon={homeOutline} />
        <span>Inicio</span>
      </button>
      <button
        className={`bottom-nav-tab${currentTab === 'lista' ? ' active' : ''}`}
        onClick={() => { if (currentTab !== 'lista') history.push('/playas'); }}
        aria-current={currentTab === 'lista' ? 'page' : undefined}
        aria-label="Playas"
      >
        <IonIcon icon={listOutline} />
        <span>Playas</span>
      </button>
      <button
        className={`bottom-nav-tab${currentTab === 'mapa' ? ' active' : ''}`}
        onClick={() => { if (currentTab !== 'mapa') history.push('/mapa'); }}
        aria-current={currentTab === 'mapa' ? 'page' : undefined}
        aria-label="Mapa"
      >
        <IonIcon icon={mapOutline} />
        <span>Mapa</span>
      </button>
    </nav>
  );
};

export default BottomNavBar;
