import "dotenv/config";

import { deepStrictEqual } from "node:assert";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { isEntrypoint } from "./_entrypoint.js";
import { SEED_PROFILES, type SeedProfile } from "./seed-profile-contract.js";
import { runSeedProfile } from "./seed-profile-runner.js";
import {
  type SeedProfileSnapshot,
  validateSeedProfile,
} from "./seed-profile-validator.js";

async function snapshotProfile(
  databaseUrl: string,
  profile: SeedProfile,
): Promise<SeedProfileSnapshot> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    return await validateSeedProfile(prisma, profile);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function proveProfile(
  databaseUrl: string,
  profile: SeedProfile,
): Promise<void> {
  runSeedProfile(profile);
  const first = await snapshotProfile(databaseUrl, profile);
  runSeedProfile(profile);
  const second = await snapshotProfile(databaseUrl, profile);
  deepStrictEqual(second, first);
  console.log(`[seed-profile-proof] ${profile}: deterministic`);
}

async function main(): Promise<void> {
  assertNonProdDestructive("seed-profile-proof");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL must be set");

  for (const profile of SEED_PROFILES) {
    await proveProfile(databaseUrl, profile);
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-profile-proof] Failed:", error);
    process.exitCode = 1;
  });
}
