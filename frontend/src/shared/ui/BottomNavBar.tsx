import React from 'react';
import { IonIcon } from '@ionic/react';
import { homeOutline, listOutline, mapOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { useIdioma } from '../i18n/IdiomaContext';
import './BottomNavBar.css';

/**
 * Which of the three tabs the current route belongs to, or null when it
 * belongs to NONE of them.
 *
 * The fallback used to be 'home', which lit the Inicio tab on pages that are
 * not the home page — and, worse, made its own guard swallow the click: on
 * /acerca-de the button believed you were already home and refused to
 * navigate. Legal pages and 404s now light nothing and every tab works.
 */
function deriveTab(pathname: string): 'home' | 'lista' | 'mapa' | null {
  if (pathname === '/') return 'home';
  // Municipality pages (and the curated /playas-* landings, which the
  // prefix already covers) are ways of browsing beaches: Playas stays lit.
  if (pathname.startsWith('/playas') || pathname.startsWith('/municipios')) return 'lista';
  if (pathname.startsWith('/mapa')) return 'mapa';
  return null;
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
