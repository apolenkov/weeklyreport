import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";
import { seedActiveSections } from "./seed-advanced.active-sections.js";
import { seedAdminExamples } from "./seed-advanced.admin-examples.js";
import { seedCrossAuthorOverlay } from "./seed-advanced.cross-author.js";
import { seedDecisions } from "./seed-advanced.decisions.js";
import { seedHistoryPeriods } from "./seed-advanced.history.js";
import { seedPublishedSections } from "./seed-advanced.published-sections.js";
import { seedReminders } from "./seed-advanced.reminders.js";
import {
  seedActiveReport,
  seedPublishedReport,
} from "./seed-advanced.reports.js";
import { seedRisks } from "./seed-advanced.risks.js";
import { seedSingletons } from "./seed-advanced.settings.js";
import { seedStageAssignments } from "./seed-advanced.stage-assignments.js";
import {
  logSeedSummary,
  sumSectionCounts,
} from "./seed-advanced.summary.js";
import { assertSeedCoverage } from "./seed-coverage-check.js";
import { seedOrganizationBaseline } from "./seed-org.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// The advanced dataset: the full demo department across five weekly periods.
// Every section below is idempotent, so a re-run over a seeded database
// restores it rather than duplicating rows.
async function main(): Promise<void> {
  assertNonProdDestructive("seed");
  await seedOrganizationBaseline(prisma);
  const stageAssignments = await seedStageAssignments(prisma);

  await seedActiveReport(prisma);
  await seedPublishedReport(prisma);

  const active = await seedActiveSections(prisma);
  const risks = await seedRisks(prisma);
  await seedCrossAuthorOverlay(prisma);
  const decisions = await seedDecisions(prisma);

  const published = await seedPublishedSections(prisma);
  const history = await seedHistoryPeriods(prisma);

  await seedAdminExamples(prisma);
  const reminders = await seedReminders(prisma);
  await seedSingletons(prisma);

  logSeedSummary({
    stageAssignments,
    sections: sumSectionCounts([active, published, history]),
    risks,
    decisions,
    reminderPolicies: reminders.policies,
    reminderRules: reminders.rules,
  });

  await assertSeedCoverage(prisma, "seed");
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
