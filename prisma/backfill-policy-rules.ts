/**
 * One-shot backfill that applies every active ReminderPolicy to every open
 * ReportPeriod.
 *
 *   pnpm db:backfill:reminder-policies
 *
 * Re-running is safe: the applicator upserts on
 * uq_rule_report_policy(reportId, policyId) — second run logs zero
 * created and N updated.
 *
 * Same validity gate as the live applicator:
 *   - policy.active === true
 *   - period.deadline >= policy.validFrom
 *   - policy.validUntil === null OR period.deadline <= policy.validUntil
 *
 * "Open" period = `periodStatus !== 'published'`. Published periods are
 * historical and we don't want to spam late reminders for already-closed
 * weeks; the live admin.savePeriod path stays the source of truth for
 * brand-new periods.
 */

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
    const periods = await prisma.report.findMany({
      where: { periodStatus: { not: "published" } },
      select: { id: true, deadline: true },
    });

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
