import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { audienceFromPrisma, audienceToPrisma } from "./admin-enum-mappers";

/**
 * ReminderPolicy CRUD.
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
      // Surface the validity window so the
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
 * Hard-delete a reminder policy and its derived rules. The policy→rule FK is
 * `ON DELETE SET NULL`, so we delete the `ReminderRule` rows explicitly first
 * (their `ReminderExecution` rows cascade with them) rather than orphaning
 * them, then delete the `ReminderPolicy` itself. This is a true delete — the
 * previous archive/soft-delete semantics are gone (D9).
 */
export async function deleteReminderPolicy(
  prisma: PrismaService,
  policyId: string,
): Promise<void> {
  await prisma.reminderRule.deleteMany({ where: { policyId } });
  await prisma.reminderPolicy.delete({ where: { id: policyId } });
}
