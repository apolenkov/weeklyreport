import { execFileSync } from "node:child_process";
import path from "node:path";

import type { SeedProfile } from "../../prisma/seeds/profiles/seed-profile-contract.js";
import {
  assertStrictNonProdDatabaseTarget,
  E2eDatabaseSetupError,
  sameE2eDatabaseTarget,
} from "./e2e-database-target.ts";

export { E2eDatabaseSetupError } from "./e2e-database-target.ts";

export interface E2eDatabaseSetup {
  readonly databaseUrl: string;
  readonly profile: SeedProfile;
  readonly repoRoot: string;
  readonly mode: E2eDatabaseSetupMode;
}

export type E2eDatabaseSetupMode = "schema+seed" | "profile-reseed";

export type E2eDatabaseSetupInput = Omit<E2eDatabaseSetup, "mode">;

export interface E2eSetupCommand {
  readonly args: readonly string[];
  readonly executable: string;
}

export function e2eSetupCommands(
  repoRoot: string,
  profile: SeedProfile,
  mode: E2eDatabaseSetupMode,
): readonly E2eSetupCommand[] {
  const schemaReset =
    mode === "schema+seed"
      ? [
          {
            executable: "pnpm",
            args: ["exec", "prisma", "migrate", "reset", "--force"],
          },
        ]
      : [];
  return [
    ...schemaReset,
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
  const developerDatabaseUrl = process.env.DATABASE_URL;
  if (
    developerDatabaseUrl !== undefined &&
    sameE2eDatabaseTarget(input.databaseUrl, developerDatabaseUrl)
  ) {
    throw new E2eDatabaseSetupError(
      "E2E_DATABASE_URL must differ from DATABASE_URL",
    );
  }
  assertStrictNonProdDatabaseTarget(
    "e2e-global-setup",
    input.databaseUrl,
    process.env.NODE_ENV,
  );

  const env = {
    ...process.env,
    DATABASE_URL: input.databaseUrl,
    E2E_DATABASE_URL: input.databaseUrl,
  };

  for (const command of e2eSetupCommands(
    input.repoRoot,
    input.profile,
    input.mode,
  )) {
    execFileSync(command.executable, [...command.args], {
      cwd: input.repoRoot,
      env,
      stdio: "inherit",
    });
  }
}

export function reseedE2eDatabase(input: E2eDatabaseSetupInput): void {
  setupE2eDatabase({ ...input, mode: "profile-reseed" });
}
