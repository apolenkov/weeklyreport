import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";
import type { ClsService } from "nestjs-cls";

import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import {
  captureJobTraceContext,
  resolveCorrelationId,
} from "../../infrastructure/bullmq/worker-observability.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import type { EscalationGroupDigest } from "./reminders-escalation-grouping.js";

export class ReminderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderDomainError";
  }
}

export interface RemindersRepository {
  getRule(ruleId: string): Promise<AdminReminderRule | null>;
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null>;
  saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution>;
  /**
   * Atomic insert-on-conflict against the `ReminderExecution.dedupeKey` unique
   * index. `inserted` is true only when THIS call created the row; a caller
   * that loses the race gets the existing row with `inserted: false`. The
   * service uses that flag to enqueue the email exactly once, even when two
   * scheduler ticks fire concurrently.
   *
   * Optional on the port because the in-memory test doubles predate it; the
   * production `RemindersPrismaRepository` always provides it, so the dispatch
   * path is atomic in production.
   */
  insertExecutionOnConflict?(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }>;
  getExecution(executionId: string): Promise<AdminReminderExecution | null>;
  listExecutions(ruleId: string): Promise<AdminReminderExecution[]>;
}

/**
 * One due deadline rule, pre-resolved with the recipient leads whose
 * `ReportSection` for the rule's report is still in `draft`. The scheduler
 * fans out one `kind='deadline'` reminder per recipient; `notificationOptOut`
 * flows through so opted-out leads are skipped (escalation digests ignore it).
 */
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

/**
 * One due escalation rule, fanned out per reporting-group head. Each entry in
 * `groups` becomes exactly one digest email to that head, aggregating only
 * that group's late leads. Resolution is independent of `Report.publishedBy`:
 * escalation fires while leads are still in `draft`, before any publish.
 */
export interface DueEscalationRule {
  id: string;
  reportId: string;
  fireAt: Date;
  reportPeriodLabel: string;
  groups: EscalationGroupDigest[];
}

/**
 * The richer payload threaded by the scheduler through
 * `requestReminderExecution`. The dedupeKey uses
 * `${rule.id}:${kind}:${cycleDate}:${recipientEmail}` so two scheduler ticks
 * within one UTC day collapse to a single execution for both kinds.
 *
 * The legacy dedupe key shape
 * (`${rule.id}:${fireAt.toISOString()}:${recipientEmail}`) is preserved for
 * callers that omit `payload`.
 *
 * Every payload carries `organization` —
 * `{shortName, fullName}` snapshotted at enqueue time from the
 * `Organization` singleton. The worker re-renders the template with that
 * snapshot, so a mid-flight admin edit of the brand strings does NOT
 * affect already-queued emails (one fewer race to debug).
 */
export interface ReminderOrganization {
  shortName: string;
  fullName: string;
}

export interface DeadlineReminderPayload {
  kind: "deadline";
  cycleDate: string; // ISO YYYY-MM-DD UTC of the fireAt deadline
  leadName: string;
  reportPeriod: string;
  deadlineIso: string;
  sectionUrl: string;
  organization: ReminderOrganization;
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
  organization: ReminderOrganization;
}

export type ReminderExecutionPayload =
  | DeadlineReminderPayload
  | EscalationReminderPayload;

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: JobEnqueuer | null;

  constructor(
    private readonly repository: RemindersRepository,
    logger?: AppLogger,
    emailQueue?: JobEnqueuer,
    private readonly cls?: ClsService,
  ) {
    this.logger = logger ?? createNullLogger();
    this.emailQueue = emailQueue ?? null;
  }

  /**
   * Record (idempotently) and enqueue one reminder execution. With a `payload`
   * the dedupe key is `${rule.id}:${kind}:${cycleDate}:${recipientEmail}`, so
   * hourly ticks within one UTC cycle collapse to a single execution; without
   * one it keeps the legacy ISO-suffixed shape. The email job is enqueued only
   * when this call actually inserted the row, so a concurrent duplicate tick
   * enqueues nothing.
   */
  async requestReminderExecution(
    ruleId: string,
    recipientEmail: string,
    payload?: ReminderExecutionPayload,
  ): Promise<AdminReminderExecution> {
    const rule = await this.repository.getRule(ruleId);

    if (!rule) {
      throw new ReminderDomainError(`Reminder rule ${ruleId} was not found.`);
    }

    if (rule.status !== "active") {
      throw new ReminderDomainError(
        "Reminder execution requires an active rule.",
      );
    }

    // Both kinds share the dedupeKey shape so two scheduler ticks within one
    // UTC day collapse to a single execution; the legacy (no-payload) caller
    // keeps its own ISO-suffixed shape.
    const dedupeKey = payload
      ? `${rule.id}:${payload.kind}:${payload.cycleDate}:${recipientEmail}`
      : `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;

    const candidate = adminReminderExecutionSchema.parse({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      reportId: rule.reportId,
      dedupeKey,
      status: "queued",
      scheduledFor: rule.fireAt,
      sentAt: null,
      recipientEmail,
      errorMessage: null,
    });

    const { execution, inserted } = await this.recordExecution(candidate);

    if (!inserted) {
      this.logger.debug("deduplicated reminder execution", {
        dedupeKey,
        ruleId,
      });
      return adminReminderExecutionSchema.parse(execution);
    }

    this.logger.info("creating reminder execution", { ruleId, recipientEmail });

    // Enqueue only after the insert has committed AND only for the caller that
    // inserted the row, so a redundant concurrent tick enqueues nothing.
    if (this.emailQueue) {
      await this.emailQueue.add(
        "send",
        {
          ...buildQueuePayload(execution, recipientEmail, rule, payload),
          ...captureJobTraceContext(resolveCorrelationId(this.cls)),
        },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
      this.logger.info("enqueued email reminder job", {
        executionId: execution.id,
      });
    }

    return execution;
  }

  /**
   * Record the execution row, preferring the repository's atomic
   * insert-on-conflict. Repositories without it (in-memory test doubles) fall
   * back to check-then-insert — safe there because nothing races them;
   * production takes the atomic path.
   */
  private async recordExecution(
    candidate: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
    if (this.repository.insertExecutionOnConflict) {
      return this.repository.insertExecutionOnConflict(candidate);
    }
    const existing = await this.repository.findExecutionByDedupeKey(
      candidate.dedupeKey,
    );
    if (existing) {
      return { execution: existing, inserted: false };
    }
    const saved = await this.repository.saveExecution(candidate);
    return { execution: saved, inserted: true };
  }

  async markReminderSent(executionId: string): Promise<AdminReminderExecution> {
    const execution = await this.repository.getExecution(executionId);

    if (!execution) {
      throw new ReminderDomainError(
        `Reminder execution ${executionId} was not found.`,
      );
    }

    this.logger.info("marking reminder sent", { executionId });
    return this.repository.saveExecution(
      adminReminderExecutionSchema.parse({
        ...execution,
        status: "sent",
        sentAt: new Date(),
      }),
    );
  }

  async listExecutions(
    ruleId: string,
    pagination?: PaginationInput,
    recipientAllowlist?: ReadonlySet<string> | null,
  ): Promise<PaginatedResult<AdminReminderExecution>> {
    const fetched = adminReminderExecutionSchema
      .array()
      .parse(await this.repository.listExecutions(ruleId));

    // Recipient-level scope: a shared report's rule can carry executions for
    // several groups' draft authors. Drop out-of-scope recipients here, over
    // the full slice, so pagination below runs on the already-scoped set and
    // out-of-scope rows can neither consume page size nor surface as
    // nextCursor. A null/undefined allowlist (admin) keeps every row.
    const all = recipientAllowlist
      ? fetched.filter((execution) =>
          recipientAllowlist.has(execution.recipientEmail),
        )
      : fetched;

    if (!pagination) {
      return { items: all, nextCursor: null };
    }

    const limit = pagination.limit;
    const startIndex = pagination.cursor
      ? all.findIndex((e) => e.id === pagination.cursor) + 1
      : 0;
    const page = all.slice(startIndex, startIndex + limit);
    // The if-condition guarantees `all[startIndex + limit - 1]` exists, but
    // TS only sees `T | undefined` after subscript access — narrow explicitly.
    const lastInPage = all.at(startIndex + limit - 1);
    const nextCursor =
      startIndex + limit < all.length && lastInPage ? lastInPage.id : null;

    return { items: page, nextCursor };
  }
}

/**
 * Build the BullMQ `send` payload for an execution. The deadline and escalation
 * payloads carry the rich template fields plus the brand snapshot; the legacy
 * (no-payload) path emits the plain-text shape the worker's legacy branch
 * renders.
 */
function buildQueuePayload(
  execution: AdminReminderExecution,
  recipientEmail: string,
  rule: AdminReminderRule,
  payload?: ReminderExecutionPayload,
): Record<string, unknown> {
  if (payload?.kind === "deadline") {
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
  if (payload?.kind === "escalation") {
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
    reportPeriod: rule.reportId ?? "",
  };
}
