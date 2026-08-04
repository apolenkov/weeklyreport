import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type OrganizationBrand,
} from "@customreport/shared";

import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import { type RemindersScopeRepository } from "./reminders-scope.types.js";

export interface RemindersRepository extends RemindersScopeRepository {
  readonly getRule: (ruleId: string) => Promise<AdminReminderRule | null>;
  readonly findExecutionByDedupeKey: (
    dedupeKey: string,
  ) => Promise<AdminReminderExecution | null>;
  readonly saveExecution: (
    execution: AdminReminderExecution,
  ) => Promise<AdminReminderExecution>;
  // Atomic insert-on-conflict; inserted=true only for the winner (enqueue once).
  readonly insertExecutionOnConflict: (
    execution: AdminReminderExecution,
  ) => Promise<{
    readonly execution: AdminReminderExecution;
    readonly inserted: boolean;
  }>;
  // CAS queued → sending; false means another worker already claimed.
  readonly transitionExecutionToSending: (
    executionId: string,
  ) => Promise<boolean>;
  // Terminal failed; never overwrites an already-sent row.
  readonly markExecutionFailed: (
    executionId: string,
    errorMessage: string,
  ) => Promise<void>;
  readonly getRulePeriodLabel: (ruleId: string) => Promise<string | null>;
  // Undo sending claim for retryable failure; no-op if already sent/failed.
  readonly releaseExecutionClaim: (executionId: string) => Promise<void>;
  // failed → queued revival; true only when this call won.
  readonly requeueFailedExecution: (executionId: string) => Promise<boolean>;
  // Time-bound reconciliation: `sending` rows presumed delivered after a
  // crashed worker resolve to `sent`; returns how many rows were reconciled.
  readonly markStuckSendingSent: (olderThan: Date) => Promise<number>;
  readonly getExecution: (
    executionId: string,
  ) => Promise<AdminReminderExecution | null>;
  readonly listExecutions: (
    ruleId: string,
    page: ExecutionPageRequest,
  ) => Promise<AdminReminderExecution[]>;
}

// Draft-section leads for a due deadline rule; opt-out skips deadline only.
export interface DueDeadlineRule {
  readonly id: string;
  readonly reportId: string;
  readonly fireAt: Date;
  readonly reportPeriodLabel: string;
  readonly recipients: readonly {
    readonly userId: string;
    readonly email: string;
    readonly name: string;
    readonly notificationOptOut: boolean;
  }[];
}

// One digest per group head; fires while leads are still draft (pre-publish).
export interface DueEscalationRule {
  readonly id: string;
  readonly reportId: string;
  readonly fireAt: Date;
  readonly reportPeriodLabel: string;
  readonly groups: readonly EscalationGroupDigest[];
}

// organization is snapshotted at enqueue so mid-flight brand edits do not
// affect already-queued emails. Omit payload → defaults to kind deadline.
export interface DeadlineReminderPayload {
  readonly kind: "deadline";
  readonly cycleDate: string; // ISO YYYY-MM-DD UTC of the fireAt deadline
  readonly leadName: string;
  readonly reportPeriod: string;
  readonly deadlineIso: string;
  readonly sectionUrl: string;
  readonly organization: OrganizationBrand;
}

export interface EscalationReminderPayload {
  readonly kind: "escalation";
  readonly cycleDate: string; // ISO YYYY-MM-DD UTC of the escalation fireAt
  readonly headName: string;
  readonly reportPeriod: string;
  readonly lateLeads: readonly {
    readonly leadName: string;
    readonly sectionTitle: string;
    readonly deadlineIso: string;
  }[];
  readonly organization: OrganizationBrand;
}

export type ReminderExecutionPayload =
  DeadlineReminderPayload | EscalationReminderPayload;
