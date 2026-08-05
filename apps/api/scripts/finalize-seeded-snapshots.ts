import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "../../../prisma/_destructive-guard.js";
import { finalizeSeededSnapshots } from "../src/modules/publication/application/seed-snapshot-finalizer.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be set");
assertNonProdDestructive("finalize-seeded-snapshots");

const pool = new pg.Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const reportIds = process.argv.slice(2).filter((value) => value.length > 0);

finalizeSeededSnapshots(prisma, reportIds.length > 0 ? reportIds : undefined)
  .then((snapshots) => {
    console.log(
      `[finalize-seeded-snapshots] Finalized ${snapshots.length} published reports.`,
    );
  })
  .catch((error: unknown) => {
    console.error("[finalize-seeded-snapshots] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
