import React, { lazy, Suspense } from 'react';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { IdiomaProvider } from './i18n/IdiomaContext';

const PlayasList = lazy(() => import('./pages/PlayasList'));
const PlayaDetallePage = lazy(() => import('./pages/PlayaDetalle'));
const MapaPage = lazy(() => import('./pages/MapaPage'));

/* Ionic core styles */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IdiomaProvider>
      <IonReactRouter>
        <Suspense fallback={<div className="ion-padding" role="status">Cargando…</div>}>
          <IonRouterOutlet animated={false}>
            <Route exact path="/" component={HomePage} />
            <Route exact path="/playas" component={PlayasList} />
            <Route exact path="/playas/:codigo" component={PlayaDetallePage} />
            <Route path="/mapa" component={MapaPage} exact />
          </IonRouterOutlet>
        </Suspense>
      </IonReactRouter>
    </IdiomaProvider>
  </IonApp>
);

export default App;
