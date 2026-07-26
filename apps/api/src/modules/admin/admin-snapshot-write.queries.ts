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

interface NewlyCreatedPeriod {
  id: string;
  deadline: Date;
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
      reportId: rule.reportId ?? null,
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

// Policy ids the snapshot itself already wrote a rule row for, per report.
// The applicator skips these pairs so a restored rule status is not clobbered;
// a report absent from the map yields `undefined`, meaning "skip nothing".
function groupRestoredPolicyIdsByReport(
  reminderRules: AdminSnapshot["reminderRules"],
): ReadonlyMap<string, ReadonlySet<string>> {
  return reminderRules.reduce<ReadonlyMap<string, ReadonlySet<string>>>(
    (byReport, rule) => {
      if (!rule.reportId || !rule.policyId) return byReport;
      const merged = new Set([
        ...(byReport.get(rule.reportId) ?? []),
        rule.policyId,
      ]);
      return new Map(byReport).set(rule.reportId, merged);
    },
    new Map(),
  );
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
  if (policyApplicator) {
    const restoredPolicyIdsByReport = groupRestoredPolicyIdsByReport(
      snapshot.reminderRules,
    );
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
