import type { AdminSnapshot } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { ensureFallbackReportingGroup } from "./admin-group.queries";
import { getSnapshot } from "./admin-snapshot.queries";
import { resolveLifecycle } from "./snapshot-lifecycle.js";

/**
 * AdminSnapshot write path, extracted from `admin-snapshot.queries.ts` (R3a-4
 * split) to keep each module under the size budget. `saveSnapshot` takes the
 * optional PolicyApplicatorService the facade injects so it can materialize
 * derived rules on newly-created periods. Its pre-existing cyclomatic
 * complexity is grandfathered (see eslint.config.ts) pending the dedicated
 * complexity-ratchet phase — this split is behavior-preserving only.
 */
export async function saveSnapshot(
  prisma: PrismaService,
  policyApplicator: PolicyApplicatorService | undefined,
  snapshot: AdminSnapshot,
): Promise<AdminSnapshot> {
  const currentGroups = await prisma.reportingGroup.findMany();
  const currentUsers = await prisma.user.findMany();
  const currentProjects = await prisma.project.findMany();
  const currentReports = await prisma.report.findMany();
  const currentRules = await prisma.reminderRule.findMany();

  // Upsert reporting groups before users so required User.reportingGroupId
  // can be validated by the database.
  const currentGroupIds = new Set(currentGroups.map((g) => g.id));
  for (const group of snapshot.groups) {
    if (currentGroupIds.has(group.id)) {
      await prisma.reportingGroup.update({
        where: { id: group.id },
        data: {
          name: group.name,
          description: group.description ?? null,
          archived: group.archived,
        },
      });
    } else {
      await prisma.reportingGroup.create({
        data: {
          id: group.id,
          name: group.name,
          description: group.description ?? null,
          archived: group.archived,
        },
      });
    }
  }

  const fallbackReportingGroupId =
    snapshot.groups.find((group) => !group.archived)?.id ??
    (await ensureFallbackReportingGroup(prisma));

  // Upsert users
  const currentUserIds = new Set(currentUsers.map((u) => u.id));
  const snapshotUserIds = new Set(snapshot.users.map((u) => u.id));

  for (const user of snapshot.users) {
    const reportingGroupId =
      user.role === "viewer"
        ? null
        : (user.reportingGroupId ?? fallbackReportingGroupId);
    if (currentUserIds.has(user.id)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          reportingGroupId,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          samlId: user.email,
          reportingGroupId,
        },
      });
    }
  }

  // Delete removed users (only those not referenced by sections/projects)
  const removedUserIds = [...currentUserIds].filter(
    (id) => !snapshotUserIds.has(id),
  );
  for (const userId of removedUserIds) {
    const hasReferences =
      (await prisma.reportSection.count({
        where: { authorId: userId },
      })) > 0 ||
      (await prisma.project.count({
        where: { leadId: userId },
      })) > 0;

    if (!hasReferences) {
      try {
        await prisma.user.delete({ where: { id: userId } });
      } catch (error: unknown) {
        // Handle FK constraint violations (Prisma P2003)
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2003") {
          // Skip deletion if user is referenced by other tables
          continue;
        }
        throw error;
      }
    }
  }

  // Upsert projects (archive removed ones instead of deleting)
  const currentProjectIds = new Set(currentProjects.map((p) => p.id));
  const snapshotProjectIds = new Set(snapshot.projects.map((p) => p.id));

  for (const project of snapshot.projects) {
    if (currentProjectIds.has(project.id)) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          name: project.name,
          archived: project.archived,
          leadId: project.leadId,
        },
      });
    } else {
      await prisma.project.create({
        data: {
          id: project.id,
          name: project.name,
          archived: project.archived,
          leadId: project.leadId,
        },
      });
    }
  }

  // Archive removed projects
  const removedProjectIds = [...currentProjectIds].filter(
    (id) => !snapshotProjectIds.has(id),
  );
  if (removedProjectIds.length > 0) {
    await prisma.project.updateMany({
      where: { id: { in: removedProjectIds } },
      data: { archived: true },
    });
  }

  // Upsert report periods
  const currentReportIds = new Set(currentReports.map((r) => r.id));
  // UFB-036 (Phase 44-03): track which periods are NEW so we can run
  // PolicyApplicator on them AFTER the upsert loop commits. Updates
  // do not re-trigger the applicator — policies attach once at create.
  const newlyCreatedPeriods: { id: string; deadline: Date }[] = [];

  for (const period of snapshot.periods) {
    if (currentReportIds.has(period.id)) {
      // lifecycle-write-gate-allow: snapshot restore reinstates a Report's
      // independently-persisted lifecycle values, it is NOT a lifecycle
      // transition — routing it through buildTransition would derive the
      // coupled set from a single field and corrupt legitimately-divergent
      // rows (a reopened period is status='published' while periodState='open'
      // and periodStatus='reopened'). The marker stays because the intent is
      // a deliberate non-transition write; `resolveLifecycle` writes the full
      // governed set verbatim (legacy snapshots backfill from the tuple).
      await prisma.report.update({
        where: { id: period.id },
        data: {
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          deadline: period.deadline,
          ...resolveLifecycle(period),
        },
      });
    } else {
      // lifecycle-write-gate-allow: snapshot restore, not a transition — see
      // the update branch above. `resolveLifecycle` reinstates the full
      // governed set so a created row is never left status='published' with a
      // stale default periodState='open'.
      await prisma.report.create({
        data: {
          id: period.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          deadline: period.deadline,
          ...resolveLifecycle(period),
        },
      });
      newlyCreatedPeriods.push({
        id: period.id,
        deadline: period.deadline,
      });
    }
  }

  // Upsert reminder rules
  const currentRuleIds = new Set(currentRules.map((r) => r.id));
  const snapshotRuleIds = new Set(snapshot.reminderRules.map((r) => r.id));

  for (const rule of snapshot.reminderRules) {
    const ruleData = {
      kind: rule.kind,
      fireAt: rule.fireAt,
      timezone: rule.timezone,
      status: rule.status,
      version: rule.version,
      reportId: rule.reportId || null,
    };

    if (currentRuleIds.has(rule.id)) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: ruleData,
      });
    } else {
      await prisma.reminderRule.create({
        data: { id: rule.id, ...ruleData },
      });
    }
  }

  // Delete removed reminder rules
  const removedRuleIds = [...currentRuleIds].filter(
    (id) => !snapshotRuleIds.has(id),
  );
  if (removedRuleIds.length > 0) {
    await prisma.reminderRule.deleteMany({
      where: { id: { in: removedRuleIds } },
    });
  }

  // UFB-036 (Phase 44-03): materialize one ReminderRule per active
  // policy on each newly-created Period. Run AFTER the per-row
  // commits so a failure in the applicator (e.g. unreachable Prisma
  // engine) cannot roll back the periods themselves.
  if (policyApplicator) {
    for (const newPeriod of newlyCreatedPeriods) {
      await policyApplicator.applyToPeriod(newPeriod);
    }
  }

  return getSnapshot(prisma);
}
