import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./src/test-utils/msw-handlers";

// Radix UI primitives (the shared Tooltip the SDLC pipeline now uses) open a
// Popper layer that calls ResizeObserver + pointer-capture/scroll APIs jsdom omits.
// The DOM lib types declare these as always present, so the stubs are installed
// through loose casts and assigned unconditionally (test environment only).
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

// Guard on Element so node-environment unit tests (no DOM) do not throw here;
// only jsdom tests render Radix and need the pointer/scroll stubs.
if (globalForStubs.Element) {
  const elementProto = globalForStubs.Element.prototype;
  elementProto.hasPointerCapture = () => false;
  elementProto.releasePointerCapture = noop;
  elementProto.scrollIntoView = noop;
}

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
