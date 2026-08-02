import React from 'react';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlayasList from './pages/PlayasList';
import PlayaDetallePage from './pages/PlayaDetalle';
import MapaPage from './pages/MapaPage';
import { IdiomaProvider } from './i18n/IdiomaContext';

// Routes are imported statically on purpose: IonRouterOutlet keeps
// its own view stack and does not tolerate an ancestor Suspense unmounting it
// while a chunk loads. On remounting, the ViewStacks of IonReactRouter (which
// lives above it) is left pointing at dead nodes and navigation breaks with a
// blank screen. To split the bundle, do it INSIDE a page.

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
        <IonRouterOutlet animated={false}>
          <Route exact path="/" component={HomePage} />
          <Route exact path="/playas" component={PlayasList} />
          {/* Canonical (slugs) and legacy (AEMET code) detail routes: both
              exact, different segment counts, same page. The legacy one must
              outlive every shared link ever sent. */}
          <Route exact path="/playas/:municipio/:playa" component={PlayaDetallePage} />
          <Route exact path="/playas/:codigo" component={PlayaDetallePage} />
          <Route path="/mapa" component={MapaPage} exact />
        </IonRouterOutlet>
      </IonReactRouter>
    </IdiomaProvider>
  </IonApp>
);

export default App;
