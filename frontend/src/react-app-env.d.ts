/// <reference types="react-scripts" />

// react-scripts only declares *.module.css; imports of plain CSS
// (./Pagina.css, leaflet/dist/leaflet.css) need this declaration
// for the IDE's TS (TS 5.9+ validates side-effect imports).
declare module '*.css';
