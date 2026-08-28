import { execFileSync } from "node:child_process";
import path from "node:path";

import type { SeedProfile } from "../../prisma/seeds/profiles/seed-profile-contract.js";
import {
  assertDistinctE2eDatabaseTarget,
  assertStrictNonProdDatabaseTarget,
} from "./e2e-database-target.ts";

export { E2eDatabaseSetupError } from "./e2e-database-target.ts";

export interface E2eDatabaseSetup {
  readonly databaseUrl: string;
  readonly profile: SeedProfile;
  readonly repoRoot: string;
}

export interface E2eSetupCommand {
  readonly args: readonly string[];
  readonly executable: string;
}

export function e2eSetupCommands(
  repoRoot: string,
  profile: SeedProfile,
): readonly E2eSetupCommand[] {
  return [
    {
      executable: "pnpm",
      args: ["exec", "prisma", "migrate", "reset", "--force"],
    },
    {
      executable: process.execPath,
      args: [
        "--import",
        "tsx",
        path.join(repoRoot, "prisma/seeds/profiles/seed-profile.ts"),
        profile,
      ],
    },
  ];
}

export function setupE2eDatabase(input: E2eDatabaseSetup): void {
  assertDistinctE2eDatabaseTarget(input.databaseUrl, process.env.DATABASE_URL);

  const env = {
    ...process.env,
    DATABASE_URL: input.databaseUrl,
    E2E_DATABASE_URL: input.databaseUrl,
  };

  for (const command of e2eSetupCommands(input.repoRoot, input.profile)) {
    // Consent and target identity are re-read immediately before every
    // destructive primitive; a valid reset never authorizes the later seed.
    assertStrictNonProdDatabaseTarget(
      "e2e-global-setup",
      input.databaseUrl,
      process.env.NODE_ENV,
    );
    execFileSync(command.executable, [...command.args], {
      cwd: input.repoRoot,
      env,
      stdio: "inherit",
    });
  }
}
