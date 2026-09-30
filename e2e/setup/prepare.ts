import { spawnSync } from "node:child_process";
import path from "node:path";

import { isEntrypoint } from "../../prisma/guards/_entrypoint.js";
import { parseSeedProfile } from "../../prisma/seeds/profiles/seed-profile-contract.js";
import { applyArchivedFillFixture } from "./archived-fill.js";
import { applyE2eFixtureOverlay } from "./overlay.js";
import { parseE2eScenario } from "./reset.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const RESET_SCRIPT = path.resolve(REPO_ROOT, "prisma/operations/reset-hard.ts");

async function prepare(): Promise<void> {
  const profile = parseSeedProfile(process.argv[2]);
  if (profile !== "demo" && profile !== "minimal") {
    throw new Error("E2E preparation supports only demo or minimal seeds");
  }
  const scenario = parseE2eScenario(profile, process.argv[3]);
  validateE2eRuntimeTarget(`e2e-prepare-${profile}`);
  // Ordinary children retain the parent's owned preparation process group.
  const reset = spawnSync(
    process.execPath,
    ["--import", "tsx", RESET_SCRIPT, profile],
    { cwd: REPO_ROOT, stdio: "inherit", shell: false, env: process.env },
  );
  if (reset.error) throw reset.error;
  if (reset.status !== 0 || reset.signal !== null) {
    throw new Error(
      `E2E reset failed: ${reset.status ?? reset.signal ?? "unknown"}`,
    );
  }
  if (profile === "demo") {
    await applyE2eFixtureOverlay(
      scenario === "section-item-limit" ? scenario : undefined,
    );
  }
  if (scenario === "archived-fill-only") await applyArchivedFillFixture();
}

if (isEntrypoint(import.meta.url)) {
  void prepare().catch((error: unknown) => {
    console.error("E2E preparation failed:", error);
    process.exitCode = 1;
  });
}
