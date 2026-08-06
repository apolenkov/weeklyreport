import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

const SOURCE_SHA = "a".repeat(40);

test("keeps deterministic runtime projects in dependency order", async () => {
  const archive = await mkdtemp(
    path.join(os.tmpdir(), "runtime-project-list-"),
  );
  try {
    process.env.E2E_DATABASE_URL = "postgresql://localhost/customreport_e2e";
    process.env.E2E_WEB_PORT = "3105";
    process.env.RUNTIME_SWEEP_ARCHIVE = archive;
    process.env.RUNTIME_SWEEP_PROFILE = "full";
    process.env.RUNTIME_SWEEP_SOURCE_SHA = SOURCE_SHA;
    const { default: config } = await import("./playwright.config.ts");
    expect(config.testDir).toBe(path.resolve(import.meta.dirname, ".."));
    const configured = config.projects ?? [];
    expect(configured.map(({ name }) => name)).toEqual([
      "runtime-prerequisites",
      "runtime-baseline",
      "runtime-matrix",
      "runtime-live-controls",
    ]);
    expect(configured.map(({ dependencies }) => dependencies ?? [])).toEqual([
      [],
      ["runtime-prerequisites"],
      ["runtime-baseline"],
      ["runtime-matrix"],
    ]);
    expect(configured.map(({ use }) => use?.viewport)).toEqual([
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
    ]);
    const webServers = config.webServer;
    if (!Array.isArray(webServers)) throw new Error("web servers missing");
    expect(webServers[0]?.env?.LOG_DIR).toBe(path.join(archive, "api-log"));
    expect(webServers[1]?.cwd).toBe(
      path.resolve(import.meta.dirname, "..", "..", ".."),
    );
    expect(webServers[1]?.command).toBe(
      "pnpm exec tsx e2e/runtime-sweep/preflight/run-runtime-next-server.ts sweep 3105",
    );

    const { default: preflightConfig } =
      await import("./playwright.preflight.config.ts");
    const preflightServers = preflightConfig.webServer;
    if (!Array.isArray(preflightServers))
      throw new Error("preflight web servers missing");
    expect(preflightServers[1]?.cwd).toBe(
      path.resolve(import.meta.dirname, "..", "..", ".."),
    );
    expect(preflightServers[1]?.command).toBe(
      "pnpm exec tsx e2e/runtime-sweep/preflight/run-runtime-next-server.ts preflight 3105",
    );
  } finally {
    delete process.env.E2E_DATABASE_URL;
    delete process.env.E2E_WEB_PORT;
    delete process.env.RUNTIME_SWEEP_ARCHIVE;
    delete process.env.RUNTIME_SWEEP_PROFILE;
    delete process.env.RUNTIME_SWEEP_SOURCE_SHA;
    await rm(archive, { recursive: true, force: true });
  }
});
