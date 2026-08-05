/**
 * DEMO seed — tiered, presenter-controlled demo data.
 *
 * One shared writer, two plain-data tiers selected from the CLI:
 *   - small (default) — THREE leads co-owning Vasily's 3 products, role-shaped,
 *     showing all three health colours at once (BI green, Integrations yellow,
 *     Portal red). See `seed-demo.small-*.ts` for the cast and its sections.
 *   - huge — the dense many-product fixture for stress/scroll demos
 *     (all canonical leads + products, templated content) in
 *     `seed-demo.huge-dataset.ts`.
 *
 * The `middle` tier is NOT defined here. `db:seed:middle` delegates to the
 * proven `prisma/seeds/simple/seed-simple.ts` as-is, which is also the byte-stable fixture
 * the CI visual-regression job seeds and the baseline `prisma/operations/reset-hard.ts`
 * re-seeds — folding it into a generic writer would risk both. See
 * `openspec/changes/demo-seed-datasets/design.md` ("Structure").
 *
 * `seed.ts` (the canonical test fixture) and `prisma.config.ts`'s
 * `migrations.seed` pointer are untouched.
 *
 * Determinism: identifiers and textual content are fixed constants (no run-time
 * randomness in IDs). Only period dates are week-relative (reused from
 * `seed-constants.ts`) so the active period always covers "today". The phase
 * order below is FK-safe and drives the row-id sequence — do not reorder it.
 *
 * Run:
 *   pnpm db:seed:small   # default demo
 *   pnpm db:seed:huge
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { assertNonProdDestructive } from "../../guards/_destructive-guard.js";
import { requireEnv } from "../../guards/_require-env.js";
import {
  PUBLISHED_REPORT_ID,
  SEED_HISTORY_REPORTS,
  SEED_REPORTS,
} from "../support/seed-constants.js";
import { assertSeedCoverage } from "../support/seed-coverage-check.js";
import { seedSmallActivities } from "./seed-demo.activities.js";
import { buildHugeDataset } from "./seed-demo.huge-dataset.js";
import { seedPriorLeadSection } from "./seed-demo.prior-sections.js";
import { seedReminders } from "./seed-demo.reminders.js";
import { seedReports } from "./seed-demo.reports.js";
import { seedScaffold } from "./seed-demo.scaffold.js";
import { groupByLead, seedActiveLeadSection } from "./seed-demo.sections.js";
import { SMALL_DATASET } from "./seed-demo.small-dataset.js";
import { seedStageAssignments } from "./seed-demo.stage-assignments.js";
import { logSeedCounts } from "./seed-demo.summary.js";
import type { Tier, TierDataset } from "./seed-demo.types.js";
import { wipe } from "./seed-demo.wipe.js";

const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedFoundation(dataset: TierDataset, tier: Tier): Promise<void> {
  console.log(`[seed-demo:${tier}] Wiping existing data...`);
  await wipe(prisma);

  console.log(
    `[seed-demo:${tier}] Seeding scaffold (group/org/users/stages/products)...`,
  );
  await seedScaffold(prisma, dataset);

  console.log(`[seed-demo:${tier}] Seeding reports (active + published)...`);
  await seedReports(prisma);
  await seedStageAssignments(prisma, dataset.sections);

  // Small tier seeds an active reminder policy+rule so the dashboard's per-lead
  // Remind action renders and dispatches for real (the huge tier is a
  // scroll/stress fixture and does not exercise the Remind affordance).
  if (tier === "small") {
    console.log(`[seed-demo:${tier}] Seeding active reminder policy + rule...`);
    await seedReminders(prisma);
  }
}

async function seedPeriodSections(
  dataset: TierDataset,
  tier: Tier,
): Promise<void> {
  console.log(`[seed-demo:${tier}] Seeding active + published sections...`);
  const byLead = [...groupByLead(dataset.sections).entries()];
  const productNames = new Map(dataset.products.map((p) => [p.id, p.name]));
  for (const [leadIdx, [leadId, contributions]] of byLead.entries()) {
    await seedActiveLeadSection(prisma, leadId, contributions, leadIdx);
  }
  if (tier === "small") {
    console.log(`[seed-demo:${tier}] Seeding project activities...`);
    await seedSmallActivities(prisma);
  }
  for (const [leadIdx, [leadId, contributions]] of byLead.entries()) {
    await seedPriorLeadSection(prisma, {
      reportIdx: 0,
      reportId: PUBLISHED_REPORT_ID,
      submittedAt: new Date(SEED_REPORTS.published.publishedAt),
      leadId,
      leadIdx,
      contributions,
      productNames,
    });
  }
  // History periods give the lead archived periods to surface the show-archived
  // toggle, and keep the head/period-switch views non-empty.
  for (const [reportOffset, h] of SEED_HISTORY_REPORTS.entries()) {
    for (const [leadIdx, [leadId, contributions]] of byLead.entries()) {
      await seedPriorLeadSection(prisma, {
        reportIdx: reportOffset + 1,
        reportId: h.id,
        submittedAt: new Date(h.periodEnd),
        leadId,
        leadIdx,
        contributions,
        productNames,
      });
    }
  }
}

async function seedDemo(tier: Tier): Promise<void> {
  assertNonProdDestructive(`seed-demo:${tier}`);
  const dataset = tier === "small" ? SMALL_DATASET : buildHugeDataset();

  await seedFoundation(dataset, tier);
  await seedPeriodSections(dataset, tier);

  await logSeedCounts(prisma, tier);
  await assertSeedCoverage(prisma, `seed-demo:${tier}`, SEED_REPORTS.active.id);
}

function parseTier(): Tier {
  const arg = process.argv[2];
  if (arg === "small" || arg === "huge") return arg;
  if (arg === undefined) return "small";
  throw new Error(
    `Unknown demo tier "${arg}". Use "small" or "huge" (middle → seed-simple.ts).`,
  );
}

seedDemo(parseTier())
  .catch((error: unknown) => {
    console.error("[seed-demo] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
