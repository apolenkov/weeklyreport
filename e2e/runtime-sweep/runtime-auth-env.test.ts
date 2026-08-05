import { describe, expect, it } from "vitest";

import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";

describe("runtimeSweepWebEnvironment", () => {
  it("keeps anonymous login stable without weakening the proxy guard", () => {
    const source = Object.freeze({
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102",
      NEXT_PUBLIC_AUTH_STUB: "false",
    });

    expect(runtimeSweepWebEnvironment(source)).toEqual({
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102",
      NEXT_PUBLIC_AUTH_STUB: "true",
      NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
    });
    expect(source.NEXT_PUBLIC_AUTH_STUB).toBe("false");
  });
});
