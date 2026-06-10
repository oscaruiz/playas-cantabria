import React from 'react';
import { IonIcon } from '@ionic/react';
import { homeOutline, listOutline, mapOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { useIdioma } from '../i18n/IdiomaContext';
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
  const { t } = useIdioma();
  const currentTab = deriveTab(pathname);

  return (
    <nav className="bottom-nav-bar" aria-label={t('nav.principal')}>
      <div className="bottom-nav-inner">
        <button
          className={`bottom-nav-tab${currentTab === 'home' ? ' active' : ''}`}
          onClick={() => { if (currentTab !== 'home') history.push('/'); }}
          aria-current={currentTab === 'home' ? 'page' : undefined}
          aria-label={t('nav.inicio')}
        >
          <IonIcon icon={homeOutline} />
          <span>{t('nav.inicio')}</span>
        </button>
        <button
          className={`bottom-nav-tab${currentTab === 'lista' ? ' active' : ''}`}
          onClick={() => { if (pathname !== '/playas') history.push('/playas'); }}
          aria-current={currentTab === 'lista' ? 'page' : undefined}
          aria-label={t('nav.playas')}
        >
          <IonIcon icon={listOutline} />
          <span>{t('nav.playas')}</span>
        </button>
        <button
          className={`bottom-nav-tab${currentTab === 'mapa' ? ' active' : ''}`}
          onClick={() => { if (currentTab !== 'mapa') history.push('/mapa'); }}
          aria-current={currentTab === 'mapa' ? 'page' : undefined}
          aria-label={t('nav.mapa')}
        >
          <IonIcon icon={mapOutline} />
          <span>{t('nav.mapa')}</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavBar;
