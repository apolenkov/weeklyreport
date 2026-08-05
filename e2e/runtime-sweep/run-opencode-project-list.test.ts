import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

const SOURCE_SHA = "a".repeat(40);
test("orders the Flash Driver after deterministic runtime projects", async () => {
  const archive = await mkdtemp(path.join(os.tmpdir(), "runtime-driver-list-"));
  try {
    process.env.E2E_DATABASE_URL = "postgresql://localhost/customreport_e2e";
    process.env.RUNTIME_SWEEP_ARCHIVE = archive;
    process.env.RUNTIME_SWEEP_PROFILE = "full";
    process.env.RUNTIME_SWEEP_SOURCE_SHA = SOURCE_SHA;
    const { default: config } = await import("./playwright.config.ts");
    const configured = config.projects ?? [];
    const projects = [
      "runtime-prerequisites",
      "runtime-baseline",
      "runtime-matrix",
      "runtime-live-controls",
      "opencode-flash-driver",
    ];
    expect(configured.map(({ name }) => name)).toEqual(projects);
    expect(configured.map(({ dependencies }) => dependencies ?? [])).toEqual([
      [],
      ["runtime-prerequisites"],
      ["runtime-baseline"],
      ["runtime-matrix"],
      ["runtime-live-controls"],
    ]);
    expect(configured.map(({ use }) => use?.viewport)).toEqual([
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
      { width: 1440, height: 900 },
    ]);
  } finally {
    delete process.env.E2E_DATABASE_URL;
    delete process.env.RUNTIME_SWEEP_ARCHIVE;
    delete process.env.RUNTIME_SWEEP_PROFILE;
    delete process.env.RUNTIME_SWEEP_SOURCE_SHA;
    await rm(archive, { recursive: true, force: true });
  }
});
