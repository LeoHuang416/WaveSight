import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// jsdom polyfills needed by Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement getComputedStyle fully — provide a stub
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  try { return originalGetComputedStyle(elt, pseudoElt); } catch { return {} as CSSStyleDeclaration; }
};
