// SIMPLE seed — minimal demo data for a live presentation (`pnpm db:seed:simple`).
// The `seed-simple.*` phase modules run in the order below; that order is
// FK-safe and must not be parallelised.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { assertSeedCoverage } from "./seed-coverage-check.js";
import {
  seedActionLog,
  seedGroupLeaderAndViewer,
  seedReminderPolicies,
  seedReopenRequest,
} from "./seed-simple.access-and-policies.js";
import { seedProjectActivities } from "./seed-simple.activities.js";
import {
  seedActivityOnlyLead,
  seedActivityParentedRecords,
} from "./seed-simple.activity-records.js";
import { seedCrossAuthorOverlay } from "./seed-simple.cross-author-overlay.js";
import {
  seedArchivedHistory,
  seedPublishedWeekSections,
} from "./seed-simple.history.js";
import {
  seedOrganizationSettings,
  seedReportingGroups,
} from "./seed-simple.organization.js";
import { seedProducts } from "./seed-simple.products.js";
import { seedReports } from "./seed-simple.reports.js";
import { seedActiveSections } from "./seed-simple.sections.js";
import { seedStageAssignments, seedStages } from "./seed-simple.stages.js";
import { logSeedSummary } from "./seed-simple.summary.js";
import { seedUsers } from "./seed-simple.users.js";
import { wipeExistingData } from "./seed-simple.wipe.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  assertNonProdDestructive("seed-simple");

  await wipeExistingData(prisma);
  await seedReportingGroups(prisma);
  await seedOrganizationSettings(prisma);
  await seedUsers(prisma);
  await seedProducts(prisma);
  await seedStages(prisma);
  await seedStageAssignments(prisma);
  await seedReports(prisma);
  await seedActiveSections(prisma);
  await seedCrossAuthorOverlay(prisma);
  await seedProjectActivities(prisma);
  await seedActivityParentedRecords(prisma);
  await seedActivityOnlyLead(prisma);
  await seedPublishedWeekSections(prisma);
  await seedArchivedHistory(prisma);
  await seedGroupLeaderAndViewer(prisma);
  await seedReopenRequest(prisma);
  await seedActionLog(prisma);
  await seedReminderPolicies(prisma);

  await logSeedSummary(prisma);
  await assertSeedCoverage(prisma, "seed-simple");
}

main()
  .catch((error: unknown) => {
    console.error("[seed-simple] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
