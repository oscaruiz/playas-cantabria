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

// jsdom exposes navigator.language = 'en-US'; we pin Spanish so that
// tests asserting Spanish text don't depend on language detection.
// (The i18n tests do localStorage.clear() when they need to test it.)
beforeEach(() => {
  localStorage.setItem('app_idioma', 'es');
});

// @testing-library/react 13 calls `act` from react-dom/test-utils, which
// React 18.3 marks as deprecated. It's library noise, not from the app's
// code, and it pollutes every render. ONLY that message is filtered: any other
// console.error remains visible.
const errorOriginal = console.error;
// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('ReactDOMTestUtils.act` is deprecated')) {
    return;
  }
  errorOriginal(...args);
};
