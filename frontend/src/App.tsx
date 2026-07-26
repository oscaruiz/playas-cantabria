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

// Las rutas se importan de forma estatica a proposito: IonRouterOutlet mantiene
// su propia pila de vistas y no tolera que un Suspense ancestro lo desmonte
// mientras carga un chunk. Al remontarse, el ViewStacks de IonReactRouter (que
// vive por encima) queda apuntando a nodos muertos y la navegacion se rompe con
// pantalla en blanco. Para dividir el bundle, hacerlo DENTRO de una pagina.

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
          <Route exact path="/playas/:codigo" component={PlayaDetallePage} />
          <Route path="/mapa" component={MapaPage} exact />
        </IonRouterOutlet>
      </IonReactRouter>
    </IdiomaProvider>
  </IonApp>
);

export default App;
