import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const container = document.getElementById('root');
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Active service worker: caches the bundle and the /api/beaches responses
// (NetworkFirst with a 3 s timeout). That way a revisit does not depend on the
// Render backend being awake nor spends quota of the free APIs.
//
// onUpdate: when a new build is detected it activates immediately and reloads
// once, so nobody gets stuck on an old version of the bundle.
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const esperando = registration.waiting;
    if (!esperando) return;
    esperando.addEventListener('statechange', (event) => {
      if ((event.target as ServiceWorker).state === 'activated') {
        window.location.reload();
      }
    });
    esperando.postMessage({ type: 'SKIP_WAITING' });
  },
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
