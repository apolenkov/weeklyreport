import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));

// The spawned loader is given 20s below, so the test must outlive it — on
// vitest's 5s default the test kills itself before its own budget expires, and
// the whole suite running in parallel is enough to reach that.
const SPAWN_BUDGET_MS = 20_000;

describe("AppModule ESM import", () => {
  it(
    "loads through the production TypeScript loader without a module cycle",
    () => {
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "--eval", 'import("./src/app.module.ts")'],
        {
          cwd: apiDirectory,
          encoding: "utf8",
          timeout: SPAWN_BUDGET_MS,
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr || result.stdout).toBe(0);
    },
    SPAWN_BUDGET_MS * 2,
  );
});
