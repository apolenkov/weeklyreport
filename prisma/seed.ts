import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertE2eRuntimeDestructive } from "./guards/_destructive-guard.js";
import { requireEnv } from "./guards/_require-env.js";
import {
  seedAiPromptBaseline,
  seedAiProviderControl,
} from "./seed-ai-prompts.js";
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
  NO_SECTION_COUNTS,
  sumSectionCounts,
} from "./seeds/advanced/seed-advanced.summary.js";
import { seedUxFixtures } from "./seeds/advanced/seed-advanced.ux-fixtures.js";
import { finalizePublishedSnapshots } from "./seeds/support/published-snapshot.js";
import { assertAssistantReadiness } from "./seeds/support/seed-assistant-readiness.js";
import { SEED_REPORTS } from "./seeds/support/seed-constants.js";
import { assertSeedCoverage } from "./seeds/support/seed-coverage-check.js";
import { seedOrganizationBaseline } from "./seeds/support/seed-org.js";

const DATABASE_URL = requireEnv("DATABASE_URL");

// The advanced dataset: the full demo department across five weekly periods.
// Every section below is idempotent, so a re-run over a seeded database
// restores it rather than duplicating rows.
async function main(): Promise<void> {
  assertE2eRuntimeDestructive("seed");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  let prisma: PrismaClient | undefined;
  let primaryFailed = false;
  let primary: unknown;
  let summary: Parameters<typeof logSeedSummary>[0] | undefined;
  try {
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const organization = await seedOrganizationBaseline(prisma);
    const { ownership, count: stageAssignments } =
      await seedStageAssignments(prisma);

    const activeReports = await seedActiveReport(prisma);
    const publishedReports = await seedPublishedReport(prisma);

    const active = await seedActiveSections(prisma, ownership);
    const risks = await seedRisks(prisma, ownership);
    await seedCrossAuthorOverlay(prisma, ownership);
    const decisions = await seedDecisions(prisma, ownership);

    const published = await seedPublishedSections(prisma, ownership);
    const history = await seedHistoryPeriods(prisma, ownership);
    const uxFixtures = await seedUxFixtures(prisma);
    await finalizePublishedSnapshots(prisma);

    const adminExamples = await seedAdminExamples(prisma);
    const reminders = await seedReminders(prisma);
    await seedSingletons(prisma);
    await seedAiProviderControl(prisma);
    await seedAiPromptBaseline(prisma);

    await assertSeedCoverage(prisma, "seed", SEED_REPORTS.active.id);
    assertAssistantReadiness("full");

    summary = {
      ...organization,
      stageAssignments,
      reports:
        activeReports + publishedReports + history.reports + uxFixtures.reports,
      sections: sumSectionCounts([
        active,
        published,
        history.sections,
        { ...NO_SECTION_COUNTS, sections: uxFixtures.sections },
      ]),
      risks,
      decisions,
      reminderPolicies: reminders.policies,
      reminderRules: reminders.rules,
      ...adminExamples,
    };
  } catch (error) {
    primaryFailed = true;
    primary = error;
  }
  const cleanupErrors: unknown[] = [];
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await pool.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (primaryFailed) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [primary, ...cleanupErrors],
        "seed failed during cleanup",
        { cause: primary },
      );
    }
    throw primary;
  }
  if (cleanupErrors.length > 0)
    throw new AggregateError(cleanupErrors, "seed cleanup failed");
  if (summary) logSeedSummary(summary);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
