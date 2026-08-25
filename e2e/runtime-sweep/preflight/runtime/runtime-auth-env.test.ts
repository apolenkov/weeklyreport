import { describe, expect, it } from "vitest";

import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";

describe("runtimeSweepWebEnvironment", () => {
  it("keeps anonymous login stable without weakening the proxy guard", () => {
    const source = Object.freeze({
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102",
      NEXT_PUBLIC_AUTH_STUB: "false",
      HTTP_PROXY: "http://127.0.0.1:1091",
      HTTPS_PROXY: "http://127.0.0.1:1091",
      ALL_PROXY: "http://127.0.0.1:1091",
      http_proxy: "http://127.0.0.1:1091",
      https_proxy: "http://127.0.0.1:1091",
      all_proxy: "http://127.0.0.1:1091",
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    });

    const result = runtimeSweepWebEnvironment(source);

    expect(result).toEqual({
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102",
      NEXT_PUBLIC_AUTH_STUB: "true",
      NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    });
    for (const key of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
    ]) {
      expect(result).not.toHaveProperty(key);
    }
    expect(source.NEXT_PUBLIC_AUTH_STUB).toBe("false");
  });
});
