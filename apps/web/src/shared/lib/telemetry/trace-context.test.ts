import { webcrypto } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTraceparent } from "./trace-context";

const TRACEPARENT_PATTERN = /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/;

describe("trace context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a valid W3C traceparent", () => {
    expect(createTraceparent()).toMatch(TRACEPARENT_PATTERN);
  });

  it("generates a valid traceparent when crypto.randomUUID is unavailable", () => {
    // Insecure contexts (the renderer's plain-http print origin) expose
    // getRandomValues but not randomUUID.
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) =>
        webcrypto.getRandomValues(array),
    });
    expect(createTraceparent()).toMatch(TRACEPARENT_PATTERN);
  });
});
