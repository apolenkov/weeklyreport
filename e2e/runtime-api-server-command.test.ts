import { describe, expect, it } from "vitest";

import { runtimeApiServerCommand } from "./runtime-api-server-command.ts";

describe("runtime API server command", () => {
  it("starts the assigned port without killing a shared development port", () => {
    expect(runtimeApiServerCommand).toContain("dev:e2e");
    expect(runtimeApiServerCommand).not.toContain("kill-port");
    expect(runtimeApiServerCommand).not.toContain("3002");
  });
});
