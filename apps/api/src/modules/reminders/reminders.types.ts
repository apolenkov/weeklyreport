import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type OrganizationBrand,
} from "@customreport/shared";

import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";
import { type RemindersScopeRepository } from "./reminders-scope.types.js";

export interface RemindersRepository extends RemindersScopeRepository {
  readonly getRule: (ruleId: string) => Promise<AdminReminderRule | null>;
  readonly findExecutionByDedupeKey: (
    dedupeKey: string,
  ) => Promise<AdminReminderExecution | null>;
  readonly markExecutionSent: (
    executionId: string,
    sentAt: Date,
  ) => Promise<AdminReminderExecution | null>;
  // One locked lifecycle decision: create, explicitly revive, or deduplicate.
  readonly insertExecutionOnConflict: (
    execution: AdminReminderExecution,
    payload: ReminderQueuePayload,
    allowFailedRevival?: boolean,
  ) => Promise<ReminderExecutionRecordResult>;
  readonly getExecutionQueuePayload: (
    executionId: string,
  ) => Promise<ReminderQueuePayload | null>;
  // CAS queued → sending; returns only the durable recipient/render payload.
  readonly transitionExecutionToSending: (
    executionId: string,
  ) => Promise<ClaimedReminderExecution | null>;
  // Terminal failed; never overwrites an already-sent row.
  readonly markExecutionFailed: (
    executionId: string,
    errorMessage: string,
  ) => Promise<void>;
  readonly getRulePeriodLabel: (ruleId: string) => Promise<string | null>;
  // Undo sending claim for retryable failure; no-op if already sent/failed.
  readonly releaseExecutionClaim: (executionId: string) => Promise<void>;
  // SMTP outcome is unknowable after a worker crash; terminalize stale
  // `sending` rows as explicit delivery-uncertain failures for manual review.
  readonly markStuckSendingUncertain: (olderThan: Date) => Promise<number>;
  readonly getExecution: (
    executionId: string,
  ) => Promise<AdminReminderExecution | null>;
  readonly listExecutions: (
    ruleId: string,
    page: ExecutionPageRequest,
  ) => Promise<AdminReminderExecution[]>;
}

export interface ReminderExecutionRecordResult {
  readonly execution: AdminReminderExecution;
  readonly outcome: "created" | "revived" | "deduplicated";
}

export interface ClaimedReminderExecution {
  readonly recipientEmail: string;
  readonly queuePayload: ReminderQueuePayload;
}

// Draft-section leads for a due deadline rule; opt-out skips deadline only.
export interface DueDeadlineRule {
  readonly id: string;
  readonly reportId: string;
  readonly fireAt: Date;
  readonly deadline: Date;
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

// Organization is snapshotted at enqueue so mid-flight brand edits do not
// affect already-queued emails.
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
