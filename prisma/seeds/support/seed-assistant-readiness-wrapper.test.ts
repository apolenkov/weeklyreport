import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSync = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ spawnSync }));

import { assertAssistantReadiness } from "./seed-assistant-readiness.js";

describe("seed assistant readiness wrapper", () => {
  beforeEach(() => {
    spawnSync.mockReset();
  });

  it("rejects an invalid tier without starting a child process", () => {
    expect(() => assertAssistantReadiness("invalid")).toThrow(
      "Unknown seed readiness tier: invalid",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("propagates a failed API readiness process", () => {
    spawnSync.mockReturnValue({ error: undefined, signal: null, status: 1 });

    expect(() => assertAssistantReadiness("full")).toThrow("exit code 1");
    expect(spawnSync).toHaveBeenCalledWith(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(
          new URL(
            "../../../apps/api/scripts/assert-seed-assistant-readiness.ts",
            import.meta.url,
          ),
        ),
        "full",
      ],
      expect.objectContaining({
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        env: expect.objectContaining({
          TSX_TSCONFIG_PATH: fileURLToPath(
            new URL("../../../apps/api/tsconfig.json", import.meta.url),
          ),
        }) as unknown,
        shell: false,
        stdio: "inherit",
      }),
    );
  });
});
