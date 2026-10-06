import React from 'react';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import BeachList from '../../../../../Dev/playas-cantabria/frontend/src/pages/BeachList';
import BeachDetailPage from '../../../../../Dev/playas-cantabria/frontend/src/pages/BeachDetailPage';
import MapPage from '../../../../../Dev/playas-cantabria/frontend/src/pages/MapPage';
import MunicipalityPage from '../../../../../Dev/playas-cantabria/frontend/src/pages/landings/MunicipalityPage';
import MunicipalitiesIndex from '../../../../../Dev/playas-cantabria/frontend/src/pages/landings/MunicipalitiesIndex';
import NotFound from '../../../../../Dev/playas-cantabria/frontend/src/pages/NotFound';
import BeachLanding, { LandingId } from '../../../../../Dev/playas-cantabria/frontend/src/pages/landings/BeachLanding';
import { LANDINGS } from '../shared/seo/landings';
import { LanguageProvider } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import LegalPage from '../pages/LegalPage';

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
    <LanguageProvider>
      <IonReactRouter>
        <IonRouterOutlet animated={false}>
          <Route exact path="/" component={HomePage} />
          <Route exact path="/playas" component={BeachList} />
          {/* Canonical (slugs) and legacy (AEMET code) detail routes: both
              exact, different segment counts, same page. The legacy one must
              outlive every shared link ever sent. */}
          <Route exact path="/playas/:municipio/:playa" component={BeachDetailPage} />
          <Route exact path="/playas/:codigo" component={BeachDetailPage} />
          <Route path="/mapa" component={MapPage} exact />
          <Route exact path="/municipios" component={MunicipalitiesIndex} />
          <Route exact path="/municipios/:municipio" component={MunicipalityPage} />
          <Route exact path="/acerca-de" render={() => <LegalPage kind="acerca" />} />
          <Route exact path="/privacidad" render={() => <LegalPage kind="privacidad" />} />
          {LANDINGS.map((l: { id: string }) => (
            <Route
              key={l.id}
              exact
              path={`/${l.id}`}
              render={() => <BeachLanding id={l.id as LandingId} />}
            />
          ))}
          {/* Catch-all LAST: the outlet picks the first match, so every
              exact route above wins; anything else is an honest not-found
              with noindex instead of a silent app shell. */}
          <Route component={NotFound} />
        </IonRouterOutlet>
      </IonReactRouter>
    </LanguageProvider>
  </IonApp>
);

export default App;
