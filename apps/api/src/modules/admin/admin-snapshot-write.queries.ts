import { type AdminSnapshot, adminSnapshotSchema } from "@customreport/shared";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { reconcileRestoredProjectAssignment } from "../../lib/project-assignment.js";
import { lockStatusGraph } from "../../lib/status-graph-lock.js";
import { lockAndAssertGroupHead } from "../../lib/user-activity-assignment.js";
import type { PolicyApplicatorService } from "../reminders/index.js";
import { replaceRestoredPublishedProjections } from "../search/index.js";
import { writePeriodRow } from "./admin-entity-write.queries";
import { getSnapshot } from "./admin-snapshot.queries";
import { lockAndValidateSnapshotAssignmentGraph } from "./admin-snapshot/assignment-graph.js";
import { lockRestoredReports } from "./admin-snapshot/period-locks.js";
import { upsertReminderExecutions } from "./admin-snapshot/reminder-execution-restore.js";
import { lockReminderRestoreGraph } from "./admin-snapshot/reminder-locks.js";
import {
  applyPoliciesToNewPeriods,
  type NewlyCreatedPeriod,
  reconcileRestoredReminderRuleStatuses,
  upsertReminderPolicies,
  upsertReminderRules,
} from "./admin-snapshot/reminders.js";
import { upsertUsers } from "./admin-snapshot/users.js";

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
  for (const group of [...groups].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    await lockAndAssertGroupHead(tx, group.headUserId);
    await tx.reportingGroup.update({
      where: { id: group.id },
      data: { headUserId: group.headUserId ?? null },
    });
  }
}

async function upsertRestoredProjects(
  tx: Prisma.TransactionClient,
  projects: AdminSnapshot["projects"],
  previousLeadByProject: ReadonlyMap<string, string>,
): Promise<void> {
  for (const project of projects) {
    await reconcileRestoredProjectAssignment(
      tx,
      project,
      previousLeadByProject.get(project.id) ?? null,
    );
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

// Additive admin-recovery restore for the contract's listed entities; this is
// not a PostgreSQL DR backup. Removals use remove* primitives. Policy
// applicator runs post-commit on newly created periods.
// Spec: openspec/specs/admin-snapshot-restore
export async function saveSnapshot(
  prisma: PrismaService,
  policyApplicator: PolicyApplicatorService | undefined,
  snapshot: AdminSnapshot,
): Promise<AdminSnapshot> {
  // Repository callers can bypass the public service, so validate here before
  // opening a transaction. Non-viewer users must carry their explicit group;
  // restore never selects or creates a substitute group.
  const parsedSnapshot = adminSnapshotSchema.parse(snapshot);
  const { newlyCreatedPeriods } = await prisma.$transaction(async (tx) => {
    await lockStatusGraph(tx);
    const currentRules = await lockReminderRestoreGraph(
      tx,
      parsedSnapshot.reminderRules.map((rule) => rule.id),
      parsedSnapshot.policies.map((policy) => policy.id),
      parsedSnapshot.periods.map((period) => period.id),
    );
    await lockRestoredReports(
      tx,
      parsedSnapshot.periods.map((period) => period.id),
    );

    const previousLeadByProject = await lockAndValidateSnapshotAssignmentGraph(
      tx,
      parsedSnapshot,
    );

    // Groups precede users because User.reportingGroupId is a foreign key.
    await upsertGroups(tx, parsedSnapshot.groups);
    await upsertUsers(tx, parsedSnapshot.users, { validateAssignments: false });
    // Apply group head assignments now that every head's User row exists;
    // upsertGroups only wrote name/description/archived.
    await applyGroupHeads(tx, parsedSnapshot.groups);
    const periods = await upsertPeriods(tx, parsedSnapshot.periods);
    await upsertRestoredProjects(
      tx,
      parsedSnapshot.projects,
      previousLeadByProject,
    );
    await replaceRestoredPublishedProjections(
      tx,
      parsedSnapshot.periods.map((period) => ({
        reportId: period.id,
        snapshot: period.publishedSnapshot,
      })),
    );
    await upsertReminderPolicies(tx, parsedSnapshot.policies);
    await upsertReminderRules(tx, parsedSnapshot.reminderRules, currentRules);
    await reconcileRestoredReminderRuleStatuses(
      tx,
      parsedSnapshot.policies,
      parsedSnapshot.periods.map((period) => period.id),
    );
    // Executions depend on rules and carry the dedupe/payload lifecycle that
    // prevents recovery from rescheduling or losing a delivery.
    await upsertReminderExecutions(tx, parsedSnapshot.reminderExecutions);

    return periods;
  });

  // Post-commit so applicator failure cannot roll back periods. Skip pairs the
  // snapshot already wrote (would clobber restored status) and pass `now` so
  // already-elapsed instants from an old snapshot are not re-dispatched.
  await applyPoliciesToNewPeriods(
    policyApplicator,
    parsedSnapshot.reminderRules,
    newlyCreatedPeriods,
  );

  return getSnapshot(prisma);
}
