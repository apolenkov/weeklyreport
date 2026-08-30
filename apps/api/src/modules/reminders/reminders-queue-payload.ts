import {
  type AdminReminderExecution,
  organizationPublicSchema,
} from "@customreport/shared";
import { z } from "zod";

import { ReminderDomainError } from "./reminders.errors.js";
import type {
  DeadlineReminderPayload,
  EscalationReminderPayload,
  ReminderExecutionPayload,
  RemindersRepository,
} from "./reminders.types.js";

export type ReminderQueuePayload = ReminderExecutionPayload;

const deadlinePayloadSchema = z
  .object({
    kind: z.literal("deadline"),
    cycleDate: z.iso.date(),
    leadName: z.string().min(1),
    reportPeriod: z.string().min(1),
    deadlineIso: z.iso.datetime(),
    sectionUrl: z.url(),
    organization: organizationPublicSchema,
  })
  .strict();

const escalationPayloadSchema = z
  .object({
    kind: z.literal("escalation"),
    cycleDate: z.iso.date(),
    headName: z.string().min(1),
    reportPeriod: z.string().min(1),
    lateLeads: z
      .array(
        z
          .object({
            leadName: z.string().min(1),
            sectionTitle: z.string().min(1),
            deadlineIso: z.iso.datetime(),
          })
          .strict(),
      )
      .min(1),
    organization: organizationPublicSchema,
  })
  .strict();

export const reminderQueuePayloadSchema = z.discriminatedUnion("kind", [
  deadlinePayloadSchema,
  escalationPayloadSchema,
]);

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
  deadlinePayloadSchema.extend(jobEnvelopeFields).strict(),
  escalationPayloadSchema.extend(jobEnvelopeFields).strict(),
]);

interface ReminderQueueJobTraceContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

export type ReminderQueueJobEnvelope = ReminderQueueJobData &
  ReminderQueueJobTraceContext;

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
  payload: ReminderQueuePayload,
): ReminderQueueJobData {
  if (payload.kind === "deadline") {
    return {
      contractVersion: 1,
      executionId: execution.id,
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
