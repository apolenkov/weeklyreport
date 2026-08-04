import { execFileSync } from "node:child_process";
import path from "node:path";

import { assertNonProdDestructiveTarget } from "../../prisma/_destructive-guard.js";
import type { SeedProfile } from "../../prisma/seed-profile-contract.js";

export interface E2eDatabaseSetup {
  readonly databaseUrl: string;
  readonly profile: SeedProfile;
  readonly repoRoot: string;
}

export interface E2eSetupCommand {
  readonly args: readonly string[];
  readonly executable: string;
}

export class E2eDatabaseSetupError extends Error {
  override readonly name = "E2eDatabaseSetupError";
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
        path.join(repoRoot, "prisma/seed-profile.ts"),
        profile,
      ],
    },
  ];
}

export function setupE2eDatabase(input: E2eDatabaseSetup): void {
  if (input.databaseUrl === process.env.DATABASE_URL) {
    throw new E2eDatabaseSetupError(
      "E2E_DATABASE_URL must differ from DATABASE_URL",
    );
  }
  const env = { ...process.env, DATABASE_URL: input.databaseUrl };
  assertNonProdDestructiveTarget("e2e-global-setup", env);

  for (const command of e2eSetupCommands(input.repoRoot, input.profile)) {
    execFileSync(command.executable, [...command.args], {
      cwd: input.repoRoot,
      env,
      stdio: "inherit",
    });
  }
}
