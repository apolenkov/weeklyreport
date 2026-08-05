import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { isEntrypoint } from "../../guards/_entrypoint.js";
import { requireEnv } from "../../guards/_require-env.js";
import { parseSeedProfile } from "./seed-profile-contract.js";
import { validateSeedProfile } from "./seed-profile-validator.js";

async function main(): Promise<void> {
  const profile = parseSeedProfile(process.argv[2]);
  const databaseUrl = requireEnv("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const snapshot = await validateSeedProfile(prisma, profile);
    console.log(`[seed-profile:${profile}] ${JSON.stringify(snapshot)}`);
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
