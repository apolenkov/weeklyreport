import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { audienceFromPrisma, audienceToPrisma } from "./admin-enum-mappers";

/**
 * List Reminder Policies.
 * @param prisma - The prisma argument.
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

/**
 * Reminder Policy Exists.
 * @param prisma - The prisma argument.
 * @param policyId - The policyId argument.
 */
export async function reminderPolicyExists(
  prisma: PrismaService,
  policyId: string,
): Promise<boolean> {
  const row = await prisma.reminderPolicy.findUnique({
    where: { id: policyId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Save Reminder Policy.
 * @param prisma - The prisma argument.
 * @param policy - The policy argument.
 */
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
  // Inactive policy parks derived rules as paused (cron skips them).
  // Applicator only (re)creates for active policies, so paused rows stay.
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

// FK is ON DELETE SET NULL — delete rules first so they are not orphaned.
/**
 * Delete Reminder Policy.
 * @param prisma - The prisma argument.
 * @param policyId - The policyId argument.
 */
export async function deleteReminderPolicy(
  prisma: PrismaService,
  policyId: string,
): Promise<void> {
  await prisma.reminderRule.deleteMany({ where: { policyId } });
  await prisma.reminderPolicy.delete({ where: { id: policyId } });
}
