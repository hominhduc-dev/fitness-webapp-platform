import "@testing-library/jest-dom/vitest"

// jsdom ships no ResizeObserver, and Radix primitives (checkbox, select) build
// one as soon as they mount. A no-op keeps those components renderable in tests.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }

  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
