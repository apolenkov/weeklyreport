import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runtimeApiServerCommand } from "./runtime-api-server-command.ts";

const API_PACKAGE_JSON = path.resolve(
  import.meta.dirname,
  "..",
  "apps/api/package.json",
);

interface ApiPackage {
  scripts?: Record<string, string>;
}

describe("runtime API server command", () => {
  it("uses the one-shot API script without a fixed port or port killer", async () => {
    const apiPackage = JSON.parse(
      await readFile(API_PACKAGE_JSON, "utf8"),
    ) as ApiPackage;
    const apiScript = apiPackage.scripts?.["start:e2e"];

    expect(runtimeApiServerCommand).toBe(
      "pnpm --filter @customreport/api start:e2e",
    );
    expect(apiScript).toBe(
      "node --env-file-if-exists=../../.env --import @swc-node/register/esm-register src/main.ts",
    );
    expect(runtimeApiServerCommand).not.toContain("dev:e2e");
    expect(runtimeApiServerCommand).not.toContain("kill-port");
    expect(runtimeApiServerCommand).not.toMatch(/\b(?:3002|3102|3105)\b/);
    expect(apiScript).not.toContain("--watch");
    expect(apiScript).not.toContain("kill-port");
    expect(apiScript).not.toMatch(/\b(?:3002|3102|3105)\b/);
  });
});
