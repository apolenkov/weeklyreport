import {
  type AdminReminderExecution,
  type AdminReminderRule,
  type OrganizationBrand,
} from "@customreport/shared";

import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import { type RemindersScopeRepository } from "./reminders-scope.types.js";

export interface RemindersRepository extends RemindersScopeRepository {
  getRule(ruleId: string): Promise<AdminReminderRule | null>;
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null>;
  saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution>;
  // Atomic insert-on-conflict; inserted=true only for the winner (enqueue once).
  insertExecutionOnConflict(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }>;
  // CAS queued → sending; false means another worker already claimed.
  transitionExecutionToSending(executionId: string): Promise<boolean>;
  // Terminal failed; never overwrites an already-sent row.
  markExecutionFailed(executionId: string, errorMessage: string): Promise<void>;
  getRulePeriodLabel(ruleId: string): Promise<string | null>;
  // Undo sending claim for retryable failure; no-op if already sent/failed.
  releaseExecutionClaim(executionId: string): Promise<void>;
  // failed → queued revival; true only when this call won.
  requeueFailedExecution(executionId: string): Promise<boolean>;
  getExecution(executionId: string): Promise<AdminReminderExecution | null>;
  listExecutions(
    ruleId: string,
    page: ExecutionPageRequest,
  ): Promise<AdminReminderExecution[]>;
}

// Draft-section leads for a due deadline rule; opt-out skips deadline only.
export interface DueDeadlineRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  recipients: {
    userId: string;
    email: string;
    name: string;
    notificationOptOut: boolean;
  }[];
}

// One digest per group head; fires while leads are still draft (pre-publish).
export interface DueEscalationRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  groups: EscalationGroupDigest[];
}

// organization is snapshotted at enqueue so mid-flight brand edits do not
// affect already-queued emails. Omit payload → defaults to kind deadline.
export interface DeadlineReminderPayload {
  kind: "deadline";
  cycleDate: string; // ISO YYYY-MM-DD UTC of the fireAt deadline
  leadName: string;
  reportPeriod: string;
  deadlineIso: string;
  sectionUrl: string;
  organization: OrganizationBrand;
}

export interface EscalationReminderPayload {
  kind: "escalation";
  cycleDate: string; // ISO YYYY-MM-DD UTC of the escalation fireAt
  headName: string;
  reportPeriod: string;
  lateLeads: readonly {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
  organization: OrganizationBrand;
}

export type ReminderExecutionPayload =
  DeadlineReminderPayload | EscalationReminderPayload;
