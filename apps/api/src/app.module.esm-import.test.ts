import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));

describe("AppModule ESM import", () => {
  it("loads through the production TypeScript loader without a module cycle", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--eval", 'import("./src/app.module.ts")'],
      {
        cwd: apiDirectory,
        encoding: "utf8",
        timeout: 20_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
