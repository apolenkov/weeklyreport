import { execFileSync } from "node:child_process";
import path from "node:path";

import { assertE2eRuntimeDestructiveTarget } from "../../prisma/guards/_destructive-guard.ts";
import { findRepoRoot } from "../integration/global-setup.js";

export default function seedProfileGlobalSetup(): void {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error("E2E_DATABASE_URL not set");
  assertE2eRuntimeDestructiveTarget(
    "seed-profile-global-setup",
    databaseUrl,
    process.env,
  );
  if (databaseUrl === process.env.DATABASE_URL) {
    throw new Error("Seed-profile smoke suite requires a dedicated E2E DB");
  }

  const repoRoot = findRepoRoot(import.meta.dirname);
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(repoRoot, "prisma/seeds/profiles/seed-profile.ts"),
      "full",
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    },
  );
}
