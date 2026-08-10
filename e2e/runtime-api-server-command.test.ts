import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "./runtime-api-server-command.ts";

const API_PACKAGE_JSON = path.resolve(
  import.meta.dirname,
  "..",
  "apps/api/package.json",
);

interface ApiPackage {
  scripts?: Record<string, string>;
}

describe("runtime API server command", () => {
  it("makes the one-shot API process own the Playwright process group", async () => {
    const apiPackage = JSON.parse(
      await readFile(API_PACKAGE_JSON, "utf8"),
    ) as ApiPackage;
    const apiScript = apiPackage.scripts?.["start:e2e"];
    if (!apiScript) throw new Error("apps/api start:e2e script is missing");

    expect(apiScript).toBe(
      "node --env-file-if-exists=../../.env --import @swc-node/register/esm-register src/main.ts",
    );
    expect(runtimeApiServerCommand).toBe(`exec ${apiScript}`);
    expect(runtimeApiServerCwd).toBe(
      path.resolve(import.meta.dirname, "../apps/api"),
    );
    expect(runtimeApiServerCommand).not.toContain("pnpm");
    expect(runtimeApiServerCommand).not.toContain("dev:e2e");
    expect(runtimeApiServerCommand).not.toContain("kill-port");
    expect(runtimeApiServerCommand).not.toMatch(/\b(?:3002|3102|3105)\b/);
    expect(apiScript).not.toContain("--watch");
    expect(apiScript).not.toContain("kill-port");
    expect(apiScript).not.toMatch(/\b(?:3002|3102|3105)\b/);
  });
});
