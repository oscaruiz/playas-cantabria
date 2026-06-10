/// <reference types="react-scripts" />

// react-scripts solo declara *.module.css; los imports de CSS plano
// (./Pagina.css, leaflet/dist/leaflet.css) necesitan esta declaración
// para el TS del IDE (TS 5.9+ valida side-effect imports).
declare module '*.css';
