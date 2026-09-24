// Base seed writer for the current product dataset.
// The `seed-simple.*` phase modules run in the order below; that order is
// FK-safe and must not be parallelised.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertE2eRuntimeDestructive } from "../../guards/_destructive-guard.js";
import { requireEnv } from "../../guards/_require-env.js";
import { finalizePublishedSnapshots } from "../support/published-snapshot.js";
import { assertAssistantReadiness } from "../support/seed-assistant-readiness.js";
import { assertSeedCoverage } from "../support/seed-coverage-check.js";
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
import { REPORT_ACTIVE } from "./seed-simple.ids.js";
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

const DATABASE_URL = requireEnv("DATABASE_URL");

async function main(): Promise<void> {
  assertE2eRuntimeDestructive("seed-simple");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
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
    await finalizePublishedSnapshots(prisma);
    await seedGroupLeaderAndViewer(prisma);
    await seedReopenRequest(prisma);
    await seedActionLog(prisma);
    await seedReminderPolicies(prisma);

    await assertSeedCoverage(prisma, "seed-simple", REPORT_ACTIVE);
    assertAssistantReadiness("demo");
    await logSeedSummary(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("[seed-simple] Failed:", error);
  process.exit(1);
});
