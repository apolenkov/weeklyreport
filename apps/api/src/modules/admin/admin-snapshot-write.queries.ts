import { type AdminSnapshot, composeName } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "../reminders/index.js";
import { writePeriodRow } from "./admin-entity-write.queries";
import { audienceToPrisma } from "./admin-enum-mappers";
import { ensureFallbackReportingGroup } from "./admin-group.queries";
import { getSnapshot } from "./admin-snapshot.queries";

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
  // Runs AFTER upsertUsers so every referenced head's User row exists.
  // upsertGroups creates/updates the group rows first but deliberately omits
  // headUserId: groups precede users in the payload, so on create the head's
  // User row does not exist yet and the FK would fail.
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
): Promise<{ newlyCreatedPeriods: { id: string; deadline: Date }[] }> {
  // Track which periods are NEW so the applicator runs on them AFTER the
  // transaction commits. Updates do not re-trigger it — policies attach once
  // at create.
  const newlyCreatedPeriods: { id: string; deadline: Date }[] = [];
  for (const period of periods) {
    const { created } = await writePeriodRow(tx, period);
    if (created) {
      newlyCreatedPeriods.push({ id: period.id, deadline: period.deadline });
    }
  }
  return { newlyCreatedPeriods };
}

async function upsertReminderPolicies(
  tx: Prisma.TransactionClient,
  policies: AdminSnapshot["policies"],
): Promise<void> {
  // Restored BEFORE the rules so a rule's non-null policyId FK resolves on a
  // fresh database. Unlike the live admin edit path (saveReminderPolicy),
  // this does NOT cascade `active` onto derived rule statuses — the snapshot
  // carries each rule row's own status and writes it explicitly below.
  for (const policy of policies) {
    const data = {
      kind: policy.kind,
      offsetMinutes: policy.offsetMinutes,
      timezone: policy.timezone,
      audience: audienceToPrisma[policy.audience],
      active: policy.active,
      validFrom: policy.validFrom,
      validUntil: policy.validUntil,
    };
    await tx.reminderPolicy.upsert({
      where: { id: policy.id },
      create: { id: policy.id, ...data },
      update: data,
    });
  }
}

async function upsertReminderRules(
  tx: Prisma.TransactionClient,
  reminderRules: AdminSnapshot["reminderRules"],
  currentRules: Awaited<ReturnType<PrismaService["reminderRule"]["findMany"]>>,
): Promise<void> {
  const currentRuleIds = new Set(currentRules.map((r) => r.id));

  for (const rule of reminderRules) {
    const ruleData = {
      policyId: rule.policyId,
      kind: rule.kind,
      fireAt: rule.fireAt,
      timezone: rule.timezone,
      status: rule.status,
      version: rule.version,
      reportId: rule.reportId || null,
    };

    if (currentRuleIds.has(rule.id)) {
      await tx.reminderRule.update({
        where: { id: rule.id },
        data: ruleData,
      });
    } else {
      await tx.reminderRule.create({
        data: { id: rule.id, ...ruleData },
      });
    }
  }
}

/**
 * Whole-snapshot restore. All DB work runs in ONE interactive
 * transaction so a mid-write failure rolls the entire restore back instead of
 * leaving a partial org state. The restore is ADDITIVE-ONLY: it upserts every
 * supplied row and never deletes/archives a row for being absent from the
 * payload — removals route through the targeted `remove*` primitives. The
 * optional PolicyApplicatorService materializes derived rules on newly-created
 * periods, strictly AFTER the transaction commits.
 */
export async function saveSnapshot(
  prisma: PrismaService,
  policyApplicator: PolicyApplicatorService | undefined,
  snapshot: AdminSnapshot,
): Promise<AdminSnapshot> {
  const { newlyCreatedPeriods } = await prisma.$transaction(async (tx) => {
    const currentRules = await tx.reminderRule.findMany();

    // Upsert reporting groups before users so required User.reportingGroupId
    // can be validated by the database. The fallback group's own upsert
    // (ensureFallbackReportingGroup) runs under `tx` too, so it cannot commit
    // ahead of a later-phase failure.
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

  // Materialize one ReminderRule per active policy on each newly-created
  // Period. Run AFTER the transaction commits so a failure in the applicator
  // (e.g. an unreachable Prisma engine) cannot roll back the periods. Two
  // restore-specific guards: pairs the snapshot itself just wrote are
  // excluded (re-materializing would clobber the restored status/fireAt —
  // e.g. force a deliberately paused rule back to active), and `now` is
  // passed so an old snapshot's already-elapsed instants are skipped instead
  // of dispatching stale reminders on the next tick.
  if (policyApplicator) {
    const restoredPolicyIdsByReport = new Map<string, Set<string>>();
    for (const rule of snapshot.reminderRules) {
      if (!rule.reportId || !rule.policyId) continue;
      const forReport =
        restoredPolicyIdsByReport.get(rule.reportId) ?? new Set<string>();
      forReport.add(rule.policyId);
      restoredPolicyIdsByReport.set(rule.reportId, forReport);
    }
    const now = new Date();
    for (const newPeriod of newlyCreatedPeriods) {
      await policyApplicator.applyToPeriod(
        newPeriod,
        now,
        restoredPolicyIdsByReport.get(newPeriod.id),
      );
    }
  }

  return getSnapshot(prisma);
}
