import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { audienceFromPrisma, audienceToPrisma } from "./admin-enum-mappers";

/**
 * UFB-036 (Phase 44-02): ReminderPolicy CRUD, extracted from
 * `admin.prisma-repository.ts` (R3a-4 max-lines split).
 */

export async function listReminderPolicies(
  prisma: PrismaService,
): Promise<ReminderPolicy[]> {
  const rows = await prisma.reminderPolicy.findMany({
    orderBy: [{ kind: "asc" }, { offsetMinutes: "asc" }],
  });
  return rows.map((row) =>
    reminderPolicySchema.parse({
      id: row.id,
      kind: row.kind,
      offsetMinutes: row.offsetMinutes,
      timezone: row.timezone,
      audience: audienceFromPrisma[row.audience],
      active: row.active,
      // UFB-036 (Phase 44-04): surface the validity window so the
      // Reminders Tab can render and edit it.
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    }),
  );
}

export async function saveReminderPolicy(
  prisma: PrismaService,
  policy: ReminderPolicy,
): Promise<ReminderPolicy> {
  const parsed = reminderPolicySchema.parse(policy);
  const data = {
    kind: parsed.kind,
    offsetMinutes: parsed.offsetMinutes,
    timezone: parsed.timezone,
    audience: audienceToPrisma[parsed.audience],
    active: parsed.active,
    validFrom: parsed.validFrom,
    validUntil: parsed.validUntil,
  };
  const row = await prisma.reminderPolicy.upsert({
    where: { id: parsed.id },
    create: { id: parsed.id, ...data },
    update: data,
  });
  // Cascade the policy's active flag onto its derived ReminderRule rows:
  // an inactive policy parks its rules as `paused` so the @Cron scheduler
  // skips them; re-activating the policy resumes them. The derived-rules
  // panel renders this status; the applicator only ever (re)creates rules
  // for active policies, so it never clobbers a parked `paused` row.
  await prisma.reminderRule.updateMany({
    where: { policyId: row.id },
    data: { status: row.active ? "active" : "paused" },
  });
  return reminderPolicySchema.parse({
    id: row.id,
    kind: row.kind,
    offsetMinutes: row.offsetMinutes,
    timezone: row.timezone,
    audience: audienceFromPrisma[row.audience],
    active: row.active,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  });
}

/**
 * Soft-delete by flipping `active=false`. Hard delete is only allowed
 * when no `ReminderRule` row references this policy — this matches the
 * 44-01 schema decision (FK is `ON DELETE SET NULL` so a hard delete
 * would orphan rules silently). Caller surfaces the explicit guard.
 */
export async function archiveReminderPolicy(
  prisma: PrismaService,
  policyId: string,
): Promise<void> {
  const derivedRuleCount = await prisma.reminderRule.count({
    where: { policyId },
  });
  if (derivedRuleCount === 0) {
    await prisma.reminderPolicy.delete({ where: { id: policyId } });
    return;
  }
  await prisma.reminderPolicy.update({
    where: { id: policyId },
    data: { active: false },
  });
  // Soft-delete parks the policy inactive; park its derived rules `paused`
  // too so the scheduler stops firing them (same cascade as a manual pause).
  await prisma.reminderRule.updateMany({
    where: { policyId },
    data: { status: "paused" },
  });
}
