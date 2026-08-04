import type { AdminReminderExecution } from "@customreport/shared";

import { ReminderDomainError } from "./reminders.errors.js";
import type {
  DeadlineReminderPayload,
  EscalationReminderPayload,
  ReminderExecutionPayload,
  RemindersRepository,
} from "./reminders.types.js";

export type ReminderQueuePayload =
  ReminderExecutionPayload | { reportPeriod: string };

// The worker-facing job shapes, built here and consumed by the email-reminder
// processor; keeping the union concrete preserves the per-kind fields instead
// of erasing them to a generic object the worker would have to re-derive.
interface DeadlineQueueData extends DeadlineReminderPayload {
  executionId: string;
  recipientEmail: string;
}
interface EscalationQueueData extends EscalationReminderPayload {
  executionId: string;
  recipientEmail: string;
}
interface PlainQueueData {
  executionId: string;
  recipientEmail: string;
  reportPeriod: string;
}

export type ReminderQueueJobData =
  DeadlineQueueData | EscalationQueueData | PlainQueueData;

// Missing period label is a domain error — never a silently empty subject.
export async function requireRulePeriodLabel(
  repository: Pick<RemindersRepository, "getRulePeriodLabel">,
  ruleId: string,
): Promise<string> {
  const reportPeriod = await repository.getRulePeriodLabel(ruleId);
  if (!reportPeriod) {
    throw new ReminderDomainError(
      `Reminder rule ${ruleId} has no report period.`,
    );
  }
  return reportPeriod;
}

// Deadline/escalation carry the rich template fields plus the brand snapshot;
// the no-payload path emits the worker's legacy plain-text shape — also what the
// reaper re-enqueues, since the rich fields are not persisted on the execution row.
export function buildQueuePayload(
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: ReminderQueuePayload,
): ReminderQueueJobData {
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
