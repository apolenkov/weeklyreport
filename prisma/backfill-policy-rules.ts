// One-shot apply of active ReminderPolicies to open (non-published) periods.
// Open excludes published so closed weeks do not get late reminders.

import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { DateTime } from "luxon";
import pg from "pg";

import { assertNonProdDestructive } from "./_destructive-guard.js";

// Load .env from repo root regardless of cwd.
const REPO_ROOT = resolve(__dirname, "..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

const DATABASE_URL: string = (() => {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  return raw;
})();

// Kept in sync BY HAND with PolicyApplicatorService.computeFireAt in
// apps/api/src/modules/reminders/policy-applicator.service.ts: the prisma
// toolchain's isolated tsconfig.prisma.json cannot import apps/api or
// packages/shared (same constraint as prisma/seed-constants.ts), so the zone-
// aware math is duplicated here. Both shift the UTC deadline into the policy's
// zone, add the exact-duration offset, and convert back to UTC.
function computeFireAt(
  deadline: Date,
  offsetMinutes: number,
  tz: string,
): Date {
  return DateTime.fromJSDate(deadline, { zone: "utc" })
    .setZone(tz)
    .plus({ minutes: offsetMinutes })
    .toUTC()
    .toJSDate();
}

function policyAppliesTo(
  policy: { active: boolean; validFrom: Date; validUntil: Date | null },
  period: { deadline: Date },
): boolean {
  if (!policy.active) return false;
  if (period.deadline.getTime() < policy.validFrom.getTime()) return false;
  if (
    policy.validUntil !== null &&
    period.deadline.getTime() > policy.validUntil.getTime()
  ) {
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  assertNonProdDestructive("backfill-policy-rules");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    const policies = await prisma.reminderPolicy.findMany({
      where: { active: true },
    });
    // deadline: { not: null } — a period whose deadline an admin explicitly
    // cleared (ruling F16) has no reference point for deadline-relative
    // rules; the backfill mints nothing for it, same as the live applicator.
    const periodRows = await prisma.report.findMany({
      where: { periodStatus: { not: "published" }, deadline: { not: null } },
      select: { id: true, deadline: true },
    });
    // The SQL filter guarantees non-null; the flatMap narrows the type so a
    // future query edit cannot silently reintroduce nullable rows here.
    const periods = periodRows.flatMap((period) =>
      period.deadline === null
        ? []
        : [{ id: period.id, deadline: period.deadline }],
    );

    console.log(
      `[backfill] active policies=${policies.length} open periods=${periods.length}`,
    );

    for (const period of periods) {
      for (const policy of policies) {
        if (!policyAppliesTo(policy, period)) {
          totalSkipped += 1;
          continue;
        }

        const fireAt = computeFireAt(
          period.deadline,
          policy.offsetMinutes,
          policy.timezone,
        );

        const existing = await prisma.reminderRule.findUnique({
          where: {
            reportId_policyId: {
              reportId: period.id,
              policyId: policy.id,
            },
          },
          select: { id: true },
        });

        await prisma.reminderRule.upsert({
          where: {
            reportId_policyId: {
              reportId: period.id,
              policyId: policy.id,
            },
          },
          create: {
            reportId: period.id,
            policyId: policy.id,
            fireAt,
            kind: policy.kind,
            timezone: policy.timezone,
            status: "active",
          },
          update: {
            fireAt,
            kind: policy.kind,
            timezone: policy.timezone,
            status: "active",
          },
        });

        if (existing) {
          totalUpdated += 1;
        } else {
          totalCreated += 1;
        }
      }
    }

    console.log(
      `[backfill] done created=${totalCreated} updated=${totalUpdated} skipped=${totalSkipped}`,
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
