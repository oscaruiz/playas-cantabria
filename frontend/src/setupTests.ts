/* eslint-disable @typescript-eslint/no-empty-function */

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect';

// Mock matchmedia
window.matchMedia = window.matchMedia || function() {
  return {
      matches: false,
      addListener: function() {},
      removeListener: function() {}
  };
};

// jsdom expone navigator.language = 'en-US'; fijamos español para que los
// tests que aserten texto en español no dependan de la detección de idioma.
// (Los tests de i18n hacen localStorage.clear() cuando necesitan probarla.)
beforeEach(() => {
  localStorage.setItem('app_idioma', 'es');
});
