import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertE2eRuntimeDestructive } from "../../guards/_destructive-guard.js";
import { isEntrypoint } from "../../guards/_entrypoint.js";
import { requireEnv } from "../../guards/_require-env.js";
import { parseSeedProfile } from "./seed-profile-contract.js";
import {
  type SeedProfileSnapshot,
  validateSeedProfile,
} from "./seed-profile-validator.js";

export function formatSeedProfileValidationSummary(
  snapshot: SeedProfileSnapshot,
): string {
  const counts = Object.entries(snapshot.counts)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(", ");
  return `[seed-profile:${snapshot.profile}] validated: ${counts}`;
}

async function main(): Promise<void> {
  const profile = parseSeedProfile(process.argv[2]);
  const databaseUrl = requireEnv("DATABASE_URL");
  assertE2eRuntimeDestructive("seed-profile-validate");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const state: {
    prisma: PrismaClient | null;
    primaryFailed: boolean;
    primary: unknown;
  } = {
    prisma: null,
    primaryFailed: false,
    primary: undefined,
  };
  const summaries: string[] = [];
  try {
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.prisma = prisma;
    const snapshot = await validateSeedProfile(prisma, profile);
    summaries.push(formatSeedProfileValidationSummary(snapshot));
  } catch (error) {
    state.primaryFailed = true;
    state.primary = error;
  }
  const cleanupErrors: unknown[] = [];
  try {
    if (state.prisma) await state.prisma.$disconnect();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await pool.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (state.primaryFailed) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [state.primary, ...cleanupErrors],
        "Seed profile validation and cleanup failed",
        { cause: state.primary },
      );
    }
    throw state.primary;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Seed profile validation cleanup failed",
    );
  }
  for (const summary of summaries) console.log(summary);
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-profile-validate] Failed:", error);
    process.exitCode = 1;
  });
}
