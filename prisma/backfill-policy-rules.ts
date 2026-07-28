// One-shot apply of active ReminderPolicies to open (non-published) periods.
// Open excludes published so closed weeks do not get late reminders.

import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ReminderPolicy } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import pg from "pg";

import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "../packages/shared/src/admin/reminder-policy-time.js";
import { assertNonProdDestructive } from "./_destructive-guard.js";

// Load .env from repo root regardless of cwd.
const REPO_ROOT = resolve(import.meta.dirname, "..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

const DATABASE_URL: string = (() => {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  return raw;
})();

interface OpenPeriod {
  readonly id: string;
  readonly deadline: Date;
}

async function loadOpenPeriods(prisma: PrismaClient): Promise<OpenPeriod[]> {
  // deadline: { not: null } — a period whose deadline an admin explicitly
  // cleared has no reference point for deadline-relative rules; the backfill
  // mints nothing for it, same as the live applicator.
  const rows = await prisma.report.findMany({
    where: { periodStatus: { not: "published" }, deadline: { not: null } },
    select: { id: true, deadline: true },
  });
  // The SQL filter guarantees non-null; the flatMap narrows the type so a
  // future query edit cannot silently reintroduce nullable rows here.
  return rows.flatMap((period) =>
    period.deadline === null
      ? []
      : [{ id: period.id, deadline: period.deadline }],
  );
}

// The pre-existing row — looked up before the upsert — is what distinguishes
// an updated rule from a created one.
async function applyPolicyToPeriod(
  prisma: PrismaClient,
  period: OpenPeriod,
  policy: ReminderPolicy,
): Promise<"created" | "updated"> {
  const where = {
    reportId_policyId: { reportId: period.id, policyId: policy.id },
  };
  const existing = await prisma.reminderRule.findUnique({
    where,
    select: { id: true },
  });

  const ruleFields = {
    fireAt: computeReminderFireAt(
      period.deadline,
      policy.offsetMinutes,
      policy.timezone,
    ),
    kind: policy.kind,
    timezone: policy.timezone,
    status: "active" as const,
  };
  await prisma.reminderRule.upsert({
    where,
    create: { reportId: period.id, policyId: policy.id, ...ruleFields },
    update: ruleFields,
  });

  return existing ? "updated" : "created";
}

interface Totals {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}

const NO_TOTALS: Totals = { created: 0, updated: 0, skipped: 0 };

// Sequential by construction: every step awaits the carried accumulator, so the
// upserts stay serialised against the table exactly as the nested loops were.
async function applyAll(
  prisma: PrismaClient,
  periods: readonly OpenPeriod[],
  policies: readonly ReminderPolicy[],
): Promise<Totals> {
  const pairs = periods.flatMap((period) =>
    policies.map((policy) => ({ period, policy })),
  );

  return pairs.reduce<Promise<Totals>>(async (carried, { period, policy }) => {
    const totals = await carried;
    if (!reminderPolicyAppliesTo(policy, period.deadline)) {
      return { ...totals, skipped: totals.skipped + 1 };
    }
    const outcome = await applyPolicyToPeriod(prisma, period, policy);
    return outcome === "updated"
      ? { ...totals, updated: totals.updated + 1 }
      : { ...totals, created: totals.created + 1 };
  }, Promise.resolve(NO_TOTALS));
}

async function main(): Promise<void> {
  assertNonProdDestructive("backfill-policy-rules");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const policies = await prisma.reminderPolicy.findMany({
      where: { active: true },
    });
    const periods = await loadOpenPeriods(prisma);

    console.log(
      `[backfill] active policies=${policies.length} open periods=${periods.length}`,
    );

    const totals = await applyAll(prisma, periods, policies);

    console.log(
      `[backfill] done created=${totals.created} updated=${totals.updated} skipped=${totals.skipped}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[backfill] failed:", error);
  process.exit(1);
});
