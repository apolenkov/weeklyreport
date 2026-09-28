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

  it("retries all-zero trace and parent identifiers", () => {
    let calls = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => {
        array.fill(calls % 2 === 0 ? 0 : 1);
        calls += 1;
        return array;
      },
    });

    expect(createTraceparent()).toBe(
      "00-01010101010101010101010101010101-0101010101010101-01",
    );
    expect(calls).toBe(4);
  });
});
