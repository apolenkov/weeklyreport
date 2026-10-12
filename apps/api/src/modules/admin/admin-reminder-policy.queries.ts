import {
  type ReminderPolicy,
  reminderPolicySchema,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  lockLiveReminderReports,
  lockReminderPolicy,
  reconcileLockedPolicyForReport,
} from "../reminders/index.js";
import { audienceFromPrisma, audienceToPrisma } from "./admin-enum-mappers";
import { AdminReminderPolicyNotFoundError } from "./admin-shared.js";

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

export async function saveReminderPolicy(
  prisma: PrismaService,
  policy: ReminderPolicy,
  now: Date = new Date(),
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
  const row = await prisma.$transaction(async (tx) => {
    await tx.reminderPolicy.upsert({
      where: { id: parsed.id },
      create: { id: parsed.id, ...data },
      update: data,
    });
    const saved = await lockReminderPolicy(tx, parsed.id);
    if (!saved) throw new Error(`Reminder policy ${parsed.id} disappeared.`);

    // Shared lock order is policy, live reports in id order, then rules.
    // Policy and every current-period rule commit together. Historical rule
    // versions stay paused so retained executions keep their exact identity.
    const reports = await lockLiveReminderReports(tx);
    // Park every prior/historical version first; reconciliation below arms
    // only the latest version of each live scheduled/editable report.
    await tx.reminderRule.updateMany({
      where: { policyId: saved.id, status: "active" },
      data: { status: "paused" },
    });
    for (const report of reports) {
      await reconcileLockedPolicyForReport(tx, saved, report, now);
    }
    return saved;
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

export async function deleteReminderPolicy(
  prisma: PrismaService,
  policyId: string,
): Promise<void> {
  // The mandatory FK cascades rules (and their executions) atomically with
  // the policy delete, so a concurrent applicator can never leave an orphan.
  // Only a missing row (P2025) becomes a typed NOT_FOUND; any other failure
  // propagates unchanged.
  try {
    await prisma.reminderPolicy.delete({ where: { id: policyId } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2025") {
      throw new AdminReminderPolicyNotFoundError(
        `Reminder policy ${policyId} was not found.`,
      );
    }
    throw error;
  }
}
