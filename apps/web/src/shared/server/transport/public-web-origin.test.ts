import { afterEach, describe, expect, it, vi } from "vitest";

import { requirePublicWebOrigin } from "./public-web-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requirePublicWebOrigin", () => {
  it.each([undefined, "", "not a URL", "ftp://reports.test"])(
    "rejects an invalid FRONTEND_URL value: %s",
    (value) => {
      vi.stubEnv("FRONTEND_URL", value);

      expect(() => requirePublicWebOrigin()).toThrow(/FRONTEND_URL/u);
    },
  );

  it.each([
    "https://reports.test/path",
    "https://reports.test/?query=value",
    "https://user:password@reports.test",
  ])("rejects a URL that is not a bare origin: %s", (value) => {
    vi.stubEnv("FRONTEND_URL", value);

    expect(() => requirePublicWebOrigin()).toThrow(/FRONTEND_URL/u);
  });

  it("normalizes a valid origin with a trailing slash", () => {
    vi.stubEnv("FRONTEND_URL", "http://lane-d.localhost:3201/");

    expect(requirePublicWebOrigin()).toBe("http://lane-d.localhost:3201");
  });
});
