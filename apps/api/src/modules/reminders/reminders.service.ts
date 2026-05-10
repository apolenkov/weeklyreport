import {
  adminReminderExecutionSchema,
  type AdminReminderExecution,
  type AdminReminderRule,
  type PaginationInput,
  type PaginatedResult,
} from '@customreport/shared';

import type { Queue } from 'bullmq';

import { createNullLogger, type AppLogger } from '../../lib/logger';

export class ReminderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReminderDomainError';
  }
}

export interface RemindersRepository {
  getRule(ruleId: string): Promise<AdminReminderRule | null>;
  findExecutionByDedupeKey(dedupeKey: string): Promise<AdminReminderExecution | null>;
  saveExecution(execution: AdminReminderExecution): Promise<AdminReminderExecution>;
  getExecution(executionId: string): Promise<AdminReminderExecution | null>;
  listExecutions(ruleId: string): Promise<AdminReminderExecution[]>;
}

/**
 * NOTIF-01/03 (Phase 28-03), NOTIF-02 (Phase 29-05): the richer payload
 * threaded by the scheduler through `requestReminderExecution`. The
 * dedupeKey uses `${rule.id}:${kind}:${cycleDate}:${recipientEmail}` so two
 * scheduler ticks within one UTC day collapse to a single execution for
 * both kinds.
 *
 * The v2.0 follow-up dedupe key shape
 * (`${rule.id}:${fireAt.toISOString()}:${recipientEmail}`) is preserved for
 * legacy callers that omit `payload`.
 *
 * UFB-047 / Phase 49-01: every payload now carries `organization` —
 * `{shortName, fullName}` snapshotted at enqueue time from the
 * `Organization` singleton. The worker re-renders the template with that
 * snapshot, so a mid-flight admin edit of the brand strings does NOT
 * affect already-queued emails (one fewer race to debug).
 */
export type ReminderOrganization = {
  shortName: string;
  fullName: string;
};

export type DeadlineReminderPayload = {
  kind: 'deadline';
  cycleDate: string; // ISO YYYY-MM-DD UTC of the fireAt deadline
  leadName: string;
  reportPeriod: string;
  deadlineIso: string;
  sectionUrl: string;
  organization: ReminderOrganization;
};

export type EscalationReminderPayload = {
  kind: 'escalation';
  cycleDate: string; // ISO YYYY-MM-DD UTC of the escalation fireAt
  headName: string;
  reportPeriod: string;
  lateLeads: ReadonlyArray<{
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }>;
  organization: ReminderOrganization;
};

export type ReminderExecutionPayload =
  | DeadlineReminderPayload
  | EscalationReminderPayload;

export class RemindersService {
  private readonly logger: AppLogger;
  private readonly emailQueue: Queue | null;

  constructor(
    private readonly repository: RemindersRepository,
    logger?: AppLogger,
    emailQueue?: Queue,
  ) {
    this.logger = logger ?? createNullLogger();
    this.emailQueue = emailQueue ?? null;
  }

  /**
   * NOTIF-01 / NOTIF-04 (Phase 28-03): requestReminderExecution accepts an
   * optional richer payload. When omitted, falls back to the legacy v2.0
   * dedupe-key shape — preserves backward compatibility for the existing
   * follow-up code path. When provided (the new scheduler path),
   * dedupe-key uses `${rule.id}:${kind}:${cycleDate}:${recipientEmail}` so
   * hourly @Cron ticks within one UTC cycle produce exactly one email.
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

    if (rule.status !== 'active') {
      throw new ReminderDomainError('Reminder execution requires an active rule.');
    }

    // NOTIF-02 (Phase 29-05): both 'deadline' and 'escalation' use the same
    // dedupeKey shape so two scheduler ticks within one UTC day collapse to
    // a single execution.
    const dedupeKey = payload
      ? `${rule.id}:${payload.kind}:${payload.cycleDate}:${recipientEmail}`
      : `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;

    const existingExecution = await this.repository.findExecutionByDedupeKey(dedupeKey);

    if (existingExecution) {
      this.logger.debug('deduplicated reminder execution', { dedupeKey, ruleId });
      return adminReminderExecutionSchema.parse(existingExecution);
    }

    this.logger.info('creating reminder execution', { ruleId, recipientEmail });
    const execution = await this.repository.saveExecution(
      adminReminderExecutionSchema.parse({
        id: crypto.randomUUID(),
        ruleId: rule.id,
        reportId: rule.reportId,
        dedupeKey,
        status: 'queued',
        scheduledFor: rule.fireAt,
        sentAt: null,
        recipientEmail,
        errorMessage: null,
      }),
    );

    if (this.emailQueue) {
      let queuePayload: Record<string, unknown>;
      if (payload?.kind === 'deadline') {
        queuePayload = {
          executionId: execution.id,
          recipientEmail,
          kind: 'deadline',
          leadName: payload.leadName,
          reportPeriod: payload.reportPeriod,
          deadlineIso: payload.deadlineIso,
          sectionUrl: payload.sectionUrl,
          // UFB-047 / Phase 49-01: brand snapshot — see ReminderOrganization.
          organization: payload.organization,
        };
      } else if (payload?.kind === 'escalation') {
        queuePayload = {
          executionId: execution.id,
          recipientEmail,
          kind: 'escalation',
          headName: payload.headName,
          cycleDate: payload.cycleDate,
          reportPeriod: payload.reportPeriod,
          lateLeads: payload.lateLeads,
          organization: payload.organization,
        };
      } else {
        // Legacy v2.0 path — no template rendering, plain text body. The
        // worker's legacy branch hardcodes the brand and is scheduled for
        // removal once all Phase 28+ kinds dominate the queue.
        queuePayload = {
          executionId: execution.id,
          recipientEmail,
          reportPeriod: rule.reportId ?? '',
        };
      }

      await this.emailQueue.add('send', queuePayload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
      this.logger.info('enqueued email reminder job', { executionId: execution.id });
    }

    return execution;
  }

  async markReminderSent(executionId: string): Promise<AdminReminderExecution> {
    const execution = await this.repository.getExecution(executionId);

    if (!execution) {
      throw new ReminderDomainError(`Reminder execution ${executionId} was not found.`);
    }

    this.logger.info('marking reminder sent', { executionId });
    return this.repository.saveExecution(
      adminReminderExecutionSchema.parse({
        ...execution,
        status: 'sent',
        sentAt: new Date(),
      }),
    );
  }

  async listExecutions(
    ruleId: string,
    pagination?: PaginationInput,
  ): Promise<PaginatedResult<AdminReminderExecution>> {
    const all = adminReminderExecutionSchema.array().parse(
      await this.repository.listExecutions(ruleId),
    );

    if (!pagination) {
      return { items: all, nextCursor: null };
    }

    const limit = pagination.limit ?? 20;
    const startIndex = pagination.cursor
      ? all.findIndex((e) => e.id === pagination.cursor) + 1
      : 0;
    const page = all.slice(startIndex, startIndex + limit);
    // The if-condition guarantees `all[startIndex + limit - 1]` exists, but
    // TS only sees `T | undefined` after subscript access — narrow explicitly.
    const lastInPage = all[startIndex + limit - 1];
    const nextCursor =
      startIndex + limit < all.length && lastInPage ? lastInPage.id : null;

    return { items: page, nextCursor };
  }
}
