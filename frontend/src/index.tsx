import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
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

// Service worker activo: cachea el bundle y las respuestas de /api/beaches
// (NetworkFirst con timeout de 3 s). Así una revisita no depende de que el
// backend en Render esté despierto ni gasta cuota de las APIs gratuitas.
//
// onUpdate: al detectar un build nuevo se activa de inmediato y se recarga una
// vez, para que nadie se quede clavado en una versión vieja del bundle.
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
