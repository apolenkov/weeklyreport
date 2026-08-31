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
});
