const noop = () => null;

Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    addEventListener: noop,
    addListener: noop,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: noop,
    removeListener: noop,
  }),
  writable: true,
});

Object.defineProperty(window, "scrollTo", {
  value: noop,
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: noop,
  writable: true,
});
