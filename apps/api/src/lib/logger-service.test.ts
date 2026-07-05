import { afterEach, describe, expect, it, vi } from "vitest";

import { createServiceLogger } from "./logger-service.js";

describe("createServiceLogger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("applies the parsed LOG_LEVEL to the returned logger", () => {
    vi.stubEnv("LOG_LEVEL", "error");
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    createServiceLogger("TestService").info("below the error threshold");

    expect(stdout).not.toHaveBeenCalled();
  });

  it("fails loud on an invalid LOG_LEVEL instead of a silent fallback", () => {
    vi.stubEnv("LOG_LEVEL", "verbose");

    expect(() => createServiceLogger("TestService")).toThrow();
  });

  it("fails loud when LOG_LEVEL is unset", () => {
    vi.stubEnv("LOG_LEVEL", undefined);

    expect(() => createServiceLogger("TestService")).toThrow();
  });
});
