import { z } from "zod";

import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "../../admin/reminder-policy-time.js";
import type { ReportStatus } from "../primitives/report-primitives.schema.js";
import type { PeriodState, PeriodStatus } from "../report/report.schema.js";
import type {
  AdminSnapshotReminderExecution,
  AdminSnapshotReminderRule,
} from "./reminder-recovery.schema.js";

const ISO_DATE_LENGTH = 10;

/** Recovery graph required for rule and execution cross-reference validation. */
export interface ReminderRecoverySnapshot {
  readonly periods: readonly RecoveryReport[];
  readonly policies: readonly RecoveryPolicy[];
  readonly reminderRules: readonly AdminSnapshotReminderRule[];
  readonly reminderExecutions: readonly AdminSnapshotReminderExecution[];
}

interface RecoveryReport {
  readonly id: string;
  readonly deadline: Date | null;
  readonly status: ReportStatus;
  readonly periodState: PeriodState;
  readonly periodStatus: PeriodStatus;
  readonly archived: boolean;
}

interface RecoveryPolicy {
  readonly id: string;
  readonly active: boolean;
  readonly kind: "deadline" | "escalation";
  readonly offsetMinutes: number;
  readonly timezone: string;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

interface IndexedRule {
  readonly index: number;
  readonly rule: AdminSnapshotReminderRule;
}

function addIssue(
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path: [...path], message });
}

function validateRuleOwners(
  entry: IndexedRule,
  reportsById: ReadonlyMap<string, RecoveryReport>,
  policiesById: ReadonlyMap<string, RecoveryPolicy>,
  context: z.RefinementCtx,
): void {
  if (!reportsById.has(entry.rule.reportId)) {
    addIssue(
      context,
      ["reminderRules", entry.index, "reportId"],
      "Reminder rule reportId must reference a snapshot period.",
    );
  }
  if (!policiesById.has(entry.rule.policyId)) {
    addIssue(
      context,
      ["reminderRules", entry.index, "policyId"],
      "Reminder rule policyId must reference a snapshot policy.",
    );
  }
}

function isLiveReport(report: RecoveryReport): boolean {
  return (
    !report.archived &&
    (report.periodState === "scheduled" || report.periodState === "open")
  );
}

function validateLatestIdentity(
  entry: IndexedRule,
  report: RecoveryReport,
  policy: RecoveryPolicy,
  context: z.RefinementCtx,
): void {
  const { index, rule } = entry;
  if (!isLiveReport(report) || report.deadline === null) {
    if (rule.status !== "paused") {
      addIssue(
        context,
        ["reminderRules", index, "status"],
        "Rules for closed, archived, or deadline-less reports must be paused.",
      );
    }
    return;
  }

  // A live report may retain a paused latest rule when additive recovery finds
  // a target-only rule whose frozen schedule no longer matches the restored
  // report or policy. Reconciliation parks that rule atomically; requiring
  // active schedule identity here would make the resulting valid restore
  // snapshot impossible to export again. Active rules remain fully checked.
  if (rule.status !== "active") return;

  const expectedFireAt = computeReminderFireAt(
    report.deadline,
    policy.offsetMinutes,
  );
  const checks: readonly [string, boolean, string][] = [
    [
      "kind",
      rule.kind !== policy.kind,
      "The latest live reminder rule kind must match its policy.",
    ],
    [
      "timezone",
      rule.timezone !== policy.timezone,
      "The latest live reminder rule timezone must match its policy.",
    ],
    [
      "deadline",
      rule.deadline.getTime() !== report.deadline.getTime(),
      "The latest live reminder rule deadline must match its report.",
    ],
    [
      "fireAt",
      rule.fireAt.getTime() !== expectedFireAt.getTime(),
      "The latest live reminder rule fireAt must match its report and policy.",
    ],
  ];
  checks.forEach(([field, invalid, message]) => {
    if (invalid) addIssue(context, ["reminderRules", index, field], message);
  });
  if (!reminderPolicyAppliesTo(policy, report.deadline)) {
    addIssue(
      context,
      ["reminderRules", index, "status"],
      "An active reminder rule requires an active policy validity window.",
    );
  }
}

function validateVersionGroup(
  entries: readonly IndexedRule[],
  reportsById: ReadonlyMap<string, RecoveryReport>,
  policiesById: ReadonlyMap<string, RecoveryPolicy>,
  context: z.RefinementCtx,
): void {
  const sorted = [...entries].sort(
    (left, right) => left.rule.version - right.rule.version,
  );
  const latest = sorted.at(-1);
  if (!latest) return;
  sorted.forEach((entry, sequenceIndex) => {
    if (entry.rule.version !== sequenceIndex + 1) {
      addIssue(
        context,
        ["reminderRules", entry.index, "version"],
        "Reminder rule versions must form a contiguous sequence starting at 1.",
      );
    }
  });
  sorted.slice(0, -1).forEach((entry) => {
    if (entry.rule.status === "active") {
      addIssue(
        context,
        ["reminderRules", entry.index, "status"],
        "Superseded reminder rule versions must be paused.",
      );
    }
  });
  const report = reportsById.get(latest.rule.reportId);
  const policy = policiesById.get(latest.rule.policyId);
  if (report && policy) {
    validateLatestIdentity(latest, report, policy, context);
  }
}

function validateRules(
  snapshot: ReminderRecoverySnapshot,
  reportsById: ReadonlyMap<string, RecoveryReport>,
  policiesById: ReadonlyMap<string, RecoveryPolicy>,
  context: z.RefinementCtx,
): void {
  const indexedRules = snapshot.reminderRules.map((rule, index) => ({
    index,
    rule,
  }));
  indexedRules.forEach((entry) => {
    validateRuleOwners(entry, reportsById, policiesById, context);
  });
  const groups = Map.groupBy(
    indexedRules,
    ({ rule }) => `${rule.reportId}\u0000${rule.policyId}`,
  );
  groups.forEach((entries) =>
    validateVersionGroup(entries, reportsById, policiesById, context),
  );
}

function validatePayloadSchedule(
  execution: AdminSnapshotReminderExecution,
  rule: AdminSnapshotReminderRule,
  path: readonly (string | number)[],
  context: z.RefinementCtx,
): void {
  const deadline = rule.deadline.getTime();
  if (execution.queuePayload.kind === "deadline") {
    if (new Date(execution.queuePayload.deadlineIso).getTime() !== deadline) {
      addIssue(
        context,
        [...path, "queuePayload", "deadlineIso"],
        "Deadline reminder payload must retain its immutable rule deadline.",
      );
    }
    const expectedPath = `/lead/report/${execution.reportId}`;
    if (
      !new URL(execution.queuePayload.sectionUrl).pathname.endsWith(
        expectedPath,
      )
    ) {
      addIssue(
        context,
        [...path, "queuePayload", "sectionUrl"],
        "Deadline reminder URL must reference its report.",
      );
    }
    return;
  }
  if (
    execution.queuePayload.lateLeads.some(
      (lead) => new Date(lead.deadlineIso).getTime() !== deadline,
    )
  ) {
    addIssue(
      context,
      [...path, "queuePayload", "lateLeads"],
      "Escalation reminder payload must retain its immutable rule deadline.",
    );
  }
}

function validateExecution(
  execution: AdminSnapshotReminderExecution,
  index: number,
  rulesById: ReadonlyMap<string, AdminSnapshotReminderRule>,
  context: z.RefinementCtx,
): void {
  const path = ["reminderExecutions", index] as const;
  const rule = rulesById.get(execution.ruleId);
  if (!rule) {
    addIssue(
      context,
      [...path, "ruleId"],
      "Reminder execution ruleId must reference a snapshot rule.",
    );
    return;
  }
  const cycleDate = execution.scheduledFor
    .toISOString()
    .slice(0, ISO_DATE_LENGTH);
  const dedupeKey = `${rule.id}:${rule.kind}:${cycleDate}:${execution.recipientEmail}`;
  const checks: readonly [string, boolean, string][] = [
    [
      "reportId",
      execution.reportId !== rule.reportId,
      "Reminder execution reportId must match its rule.",
    ],
    [
      "scheduledFor",
      execution.scheduledFor.getTime() !== rule.fireAt.getTime(),
      "Reminder execution schedule must match its immutable rule fireAt.",
    ],
    [
      "queuePayload",
      execution.queuePayload.kind !== rule.kind ||
        execution.queuePayload.cycleDate !== cycleDate,
      "Reminder execution payload must match its rule kind and cycle.",
    ],
    [
      "dedupeKey",
      execution.dedupeKey !== dedupeKey,
      "Reminder execution dedupeKey must match its rule, payload, and recipient.",
    ],
  ];
  checks.forEach(([field, invalid, message]) => {
    if (invalid) addIssue(context, [...path, field], message);
  });
  validatePayloadSchedule(execution, rule, path, context);
}

/** Adds cross-entity recovery issues without opening a restore transaction. */
export function validateReminderRecoveryReferences(
  snapshot: ReminderRecoverySnapshot,
  context: z.RefinementCtx,
): void {
  const reportsById = new Map(snapshot.periods.map((row) => [row.id, row]));
  const policiesById = new Map(snapshot.policies.map((row) => [row.id, row]));
  const rulesById = new Map(snapshot.reminderRules.map((row) => [row.id, row]));
  validateRules(snapshot, reportsById, policiesById, context);
  snapshot.reminderExecutions.forEach((execution, index) =>
    validateExecution(execution, index, rulesById, context),
  );
}
