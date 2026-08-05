import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./guards/_destructive-guard.js";
import { requireEnv } from "./guards/_require-env.js";
import { seedActiveSections } from "./seeds/advanced/seed-advanced.active-sections.js";
import { seedAdminExamples } from "./seeds/advanced/seed-advanced.admin-examples.js";
import { seedCrossAuthorOverlay } from "./seeds/advanced/seed-advanced.cross-author.js";
import { seedDecisions } from "./seeds/advanced/seed-advanced.decisions.js";
import { seedHistoryPeriods } from "./seeds/advanced/seed-advanced.history.js";
import { seedPublishedSections } from "./seeds/advanced/seed-advanced.published-sections.js";
import { seedReminders } from "./seeds/advanced/seed-advanced.reminders.js";
import {
  seedActiveReport,
  seedPublishedReport,
} from "./seeds/advanced/seed-advanced.reports.js";
import { seedRisks } from "./seeds/advanced/seed-advanced.risks.js";
import { seedSingletons } from "./seeds/advanced/seed-advanced.settings.js";
import { seedStageAssignments } from "./seeds/advanced/seed-advanced.stage-assignments.js";
import {
  logSeedSummary,
  sumSectionCounts,
} from "./seeds/advanced/seed-advanced.summary.js";
import { SEED_REPORTS } from "./seeds/support/seed-constants.js";
import { assertSeedCoverage } from "./seeds/support/seed-coverage-check.js";
import { seedOrganizationBaseline } from "./seeds/support/seed-org.js";

const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// The advanced dataset: the full demo department across five weekly periods.
// Every section below is idempotent, so a re-run over a seeded database
// restores it rather than duplicating rows.
async function main(): Promise<void> {
  assertNonProdDestructive("seed");
  const organization = await seedOrganizationBaseline(prisma);
  const stageAssignments = await seedStageAssignments(prisma);

  const activeReports = await seedActiveReport(prisma);
  const publishedReports = await seedPublishedReport(prisma);

  const active = await seedActiveSections(prisma);
  const risks = await seedRisks(prisma);
  await seedCrossAuthorOverlay(prisma);
  const decisions = await seedDecisions(prisma);

  const published = await seedPublishedSections(prisma);
  const history = await seedHistoryPeriods(prisma);

  const adminExamples = await seedAdminExamples(prisma);
  const reminders = await seedReminders(prisma);
  await seedSingletons(prisma);

  logSeedSummary({
    ...organization,
    stageAssignments,
    reports: activeReports + publishedReports + history.reports,
    sections: sumSectionCounts([active, published, history.sections]),
    risks,
    decisions,
    reminderPolicies: reminders.policies,
    reminderRules: reminders.rules,
    ...adminExamples,
  });

  await assertSeedCoverage(prisma, "seed", SEED_REPORTS.active.id);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
