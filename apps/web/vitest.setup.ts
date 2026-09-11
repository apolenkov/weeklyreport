import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Radix UI primitives open a Popper layer that calls ResizeObserver and
// pointer-capture/scroll APIs jsdom omits.
// Install the ResizeObserver stub only when absent, and guard Element-dependent
// stubs because this setup can also load in tests without a DOM.
const noop = (): void => undefined;

class ResizeObserverStub {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}
const globalForStubs = globalThis as unknown as {
  ResizeObserver?: unknown;
  Element?: { prototype: Record<string, unknown> };
};
globalForStubs.ResizeObserver ??= ResizeObserverStub;

if (globalForStubs.Element) {
  const elementProto = globalForStubs.Element.prototype;
  elementProto.hasPointerCapture = () => false;
  elementProto.releasePointerCapture = noop;
  elementProto.scrollIntoView = noop;
}

afterEach(() => {
  cleanup();
});
