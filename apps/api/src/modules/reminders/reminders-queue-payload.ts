import {
  type AdminReminderExecution,
  reminderDeadlinePayloadSchema,
  reminderEscalationPayloadSchema,
  type ReminderQueuePayload,
  reminderQueuePayloadSchema,
} from "@customreport/shared";
import { z } from "zod";

import type { JobTraceContext } from "../../lib/job-trace-context.js";
import { ReminderDomainError } from "./reminders.errors.js";
import type {
  DeadlineReminderPayload,
  EscalationReminderPayload,
  ReminderExecutionPayload,
  RemindersRepository,
} from "./reminders.types.js";

export { type ReminderQueuePayload, reminderQueuePayloadSchema };

export function buildPersistedQueuePayload(
  payload: ReminderExecutionPayload,
): ReminderQueuePayload {
  return reminderQueuePayloadSchema.parse({
    ...payload,
    contractVersion: 1,
  });
}

// The worker-facing job shapes, built here and consumed by the email-reminder
// processor; keeping the union concrete preserves the per-kind fields instead
// of erasing them to a generic object the worker would have to re-derive.
interface ReminderQueueEnvelope {
  readonly contractVersion: 1;
  readonly executionId: string;
  readonly recipientEmail: string;
}
export interface DeadlineQueueData
  extends DeadlineReminderPayload, ReminderQueueEnvelope {}
export interface EscalationQueueData
  extends EscalationReminderPayload, ReminderQueueEnvelope {}
export type ReminderQueueJobData = DeadlineQueueData | EscalationQueueData;

const jobEnvelopeFields = {
  contractVersion: z.literal(1),
  executionId: z.string().min(1),
  recipientEmail: z.string().min(1),
  traceparent: z.string().min(1).optional(),
  tracestate: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
} as const;

const reminderQueueJobDataSchema = z.discriminatedUnion("kind", [
  reminderDeadlinePayloadSchema.extend(jobEnvelopeFields).strict(),
  reminderEscalationPayloadSchema.extend(jobEnvelopeFields).strict(),
]);

export type ReminderQueueJobEnvelope = ReminderQueueJobData & JobTraceContext;

export function parseReminderQueueJobData(
  value: unknown,
): ReminderQueueJobEnvelope {
  return reminderQueueJobDataSchema.parse(value) as ReminderQueueJobEnvelope;
}

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

// Deadline/escalation carry the rich template fields plus the brand snapshot.
export function buildQueuePayload(
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: ReminderExecutionPayload,
): ReminderQueueJobData {
  return buildReminderQueueJobData(execution.id, recipientEmail, payload);
}

export function buildReminderQueueJobData(
  executionId: string,
  recipientEmail: string,
  payload: ReminderExecutionPayload,
): ReminderQueueJobData {
  if (payload.kind === "deadline") {
    return {
      contractVersion: 1,
      executionId,
      recipientEmail,
      kind: "deadline",
      cycleDate: payload.cycleDate,
      leadName: payload.leadName,
      reportPeriod: payload.reportPeriod,
      deadlineIso: payload.deadlineIso,
      sectionUrl: payload.sectionUrl,
      organization: payload.organization,
    };
  }
  return {
    contractVersion: 1,
    executionId,
    recipientEmail,
    kind: "escalation",
    headName: payload.headName,
    cycleDate: payload.cycleDate,
    reportPeriod: payload.reportPeriod,
    lateLeads: payload.lateLeads,
    organization: payload.organization,
  };
}
