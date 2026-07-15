import type { AdminReminderExecution } from "@customreport/shared";

import { ReminderDomainError } from "./reminders.errors.js";
import type {
  ReminderExecutionPayload,
  RemindersRepository,
} from "./reminders.service.js";

export type ReminderQueuePayload =
  | ReminderExecutionPayload
  | { reportPeriod: string };

/**
 * Resolve the formatted period label a legacy/reaper payload requires. The
 * port method is optional (older test doubles predate it), but every enqueue
 * that reaches here needs the label — a missing one is a domain error, never
 * a silently empty email subject.
 */
export async function requireRulePeriodLabel(
  repository: Pick<RemindersRepository, "getRulePeriodLabel">,
  ruleId: string,
): Promise<string> {
  const reportPeriod = await repository.getRulePeriodLabel?.(ruleId);
  if (!reportPeriod) {
    throw new ReminderDomainError(
      `Reminder rule ${ruleId} has no report period.`,
    );
  }
  return reportPeriod;
}

/**
 * Build the BullMQ `send` payload for an execution. The deadline and escalation
 * payloads carry the rich template fields plus the brand snapshot; the legacy
 * (no-payload) path emits the plain-text shape the worker's legacy branch
 * renders — and is also what the reaper re-enqueues, since the rich template
 * fields are not persisted on the execution row.
 */
export function buildQueuePayload(
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: ReminderQueuePayload,
): Record<string, unknown> {
  if ("kind" in payload) {
    if (payload.kind === "deadline") {
      return {
        executionId: execution.id,
        recipientEmail,
        kind: "deadline",
        leadName: payload.leadName,
        reportPeriod: payload.reportPeriod,
        deadlineIso: payload.deadlineIso,
        sectionUrl: payload.sectionUrl,
        organization: payload.organization,
      };
    }
    return {
      executionId: execution.id,
      recipientEmail,
      kind: "escalation",
      headName: payload.headName,
      cycleDate: payload.cycleDate,
      reportPeriod: payload.reportPeriod,
      lateLeads: payload.lateLeads,
      organization: payload.organization,
    };
  }
  return {
    executionId: execution.id,
    recipientEmail,
    reportPeriod: payload.reportPeriod,
  };
}
