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
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const snapshot = await validateSeedProfile(prisma, profile);
    console.log(formatSeedProfileValidationSummary(snapshot));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-profile-validate] Failed:", error);
    process.exitCode = 1;
  });
}
