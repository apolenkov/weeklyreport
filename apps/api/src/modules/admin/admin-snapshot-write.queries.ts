import { type AdminSnapshot, composeName } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { ensureFallbackReportingGroup } from "../organization/index.js";
import type { PolicyApplicatorService } from "../reminders/index.js";
import { writePeriodRow } from "./admin-entity-write.queries";
import { getSnapshot } from "./admin-snapshot.queries";
import {
  applyPoliciesToNewPeriods,
  type NewlyCreatedPeriod,
  upsertReminderPolicies,
  upsertReminderRules,
} from "./admin-snapshot/reminders.js";

async function upsertGroups(
  tx: Prisma.TransactionClient,
  groups: AdminSnapshot["groups"],
): Promise<void> {
  const currentGroupIds = new Set(
    (await tx.reportingGroup.findMany()).map((g) => g.id),
  );
  for (const group of groups) {
    if (currentGroupIds.has(group.id)) {
      await tx.reportingGroup.update({
        where: { id: group.id },
        data: {
          name: group.name,
          description: group.description ?? null,
          archived: group.archived,
        },
      });
    } else {
      await tx.reportingGroup.create({
        data: {
          id: group.id,
          name: group.name,
          description: group.description ?? null,
          archived: group.archived,
        },
      });
    }
  }
}

async function applyGroupHeads(
  tx: Prisma.TransactionClient,
  groups: AdminSnapshot["groups"],
): Promise<void> {
  // After upsertUsers: groups precede users, so headUserId was omitted earlier
  // (FK would fail on create while the head User row did not exist yet).
  for (const group of groups) {
    await tx.reportingGroup.update({
      where: { id: group.id },
      data: { headUserId: group.headUserId ?? null },
    });
  }
}

async function upsertUsers(
  tx: Prisma.TransactionClient,
  users: AdminSnapshot["users"],
  fallbackReportingGroupId: string,
): Promise<void> {
  const currentUserIds = new Set((await tx.user.findMany()).map((u) => u.id));

  for (const user of users) {
    const reportingGroupId =
      user.role === "viewer"
        ? null
        : (user.reportingGroupId ?? fallbackReportingGroupId);
    // Recompute the denormalized display name from the structured parts
    // server-side so the `name === composeName(parts)` invariant holds for
    // EVERY admin client / imported snapshot, not just the web form mapper.
    const name = composeName({
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName,
    });
    if (currentUserIds.has(user.id)) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          position: user.position,
          role: user.role,
          reportingGroupId,
          isActive: user.isActive,
        },
      });
    } else {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          position: user.position,
          role: user.role,
          samlId: user.email,
          reportingGroupId,
          isActive: user.isActive,
        },
      });
    }
  }
}

async function upsertProjects(
  tx: Prisma.TransactionClient,
  projects: AdminSnapshot["projects"],
): Promise<void> {
  const currentProjectIds = new Set(
    (await tx.project.findMany()).map((p) => p.id),
  );

  for (const project of projects) {
    if (currentProjectIds.has(project.id)) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          name: project.name,
          archived: project.archived,
          leadId: project.leadId,
        },
      });
    } else {
      await tx.project.create({
        data: {
          id: project.id,
          name: project.name,
          archived: project.archived,
          leadId: project.leadId,
        },
      });
    }
  }
}

async function upsertPeriods(
  tx: Prisma.TransactionClient,
  periods: AdminSnapshot["periods"],
): Promise<{ newlyCreatedPeriods: NewlyCreatedPeriod[] }> {
  // New periods only (post-commit applicator); deadline-less excluded because
  // reminder offsets are deadline-relative. The reduce threads a promise so the
  // row writes stay sequential inside the transaction.
  const newlyCreatedPeriods = await periods.reduce<
    Promise<NewlyCreatedPeriod[]>
  >(async (pending, period) => {
    const accumulated = await pending;
    const { created } = await writePeriodRow(tx, period);
    return created && period.deadline !== null
      ? [...accumulated, { id: period.id, deadline: period.deadline }]
      : accumulated;
  }, Promise.resolve([]));
  return { newlyCreatedPeriods };
}

// Additive-only whole-snapshot restore in one txn; removals use remove* primitives.
// Policy applicator runs post-commit on newly created periods.
// Spec: openspec/specs/admin-snapshot-restore
export async function saveSnapshot(
  prisma: PrismaService,
  policyApplicator: PolicyApplicatorService | undefined,
  snapshot: AdminSnapshot,
): Promise<AdminSnapshot> {
  const { newlyCreatedPeriods } = await prisma.$transaction(async (tx) => {
    const currentRules = await tx.reminderRule.findMany();

    // Groups before users (User.reportingGroupId FK); fallback upsert under tx.
    await upsertGroups(tx, snapshot.groups);

    const fallbackReportingGroupId =
      snapshot.groups.find((group) => !group.archived)?.id ??
      (await ensureFallbackReportingGroup(tx));

    await upsertUsers(tx, snapshot.users, fallbackReportingGroupId);
    // Apply group head assignments now that every head's User row exists;
    // upsertGroups only wrote name/description/archived.
    await applyGroupHeads(tx, snapshot.groups);
    await upsertProjects(tx, snapshot.projects);
    const periods = await upsertPeriods(tx, snapshot.periods);
    await upsertReminderPolicies(tx, snapshot.policies);
    await upsertReminderRules(tx, snapshot.reminderRules, currentRules);

    return periods;
  });

  // Post-commit so applicator failure cannot roll back periods. Skip pairs the
  // snapshot already wrote (would clobber restored status) and pass `now` so
  // already-elapsed instants from an old snapshot are not re-dispatched.
  await applyPoliciesToNewPeriods(
    policyApplicator,
    snapshot.reminderRules,
    newlyCreatedPeriods,
  );

  return getSnapshot(prisma);
}
