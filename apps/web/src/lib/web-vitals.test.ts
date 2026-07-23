import { describe, expect, it, vi } from "vitest";

vi.mock("./web-env", () => ({
  webEnv: {
    webVitals: () => true,
  },
}));

vi.mock("web-vitals", () => {
  throw new Error("chunk load failed");
});

import { reportWebVitals } from "./web-vitals";

describe("reportWebVitals", () => {
  it("absorbs a rejected web-vitals chunk import", async () => {
    expect(() => reportWebVitals()).not.toThrow();
    await Promise.resolve();
  });
});
