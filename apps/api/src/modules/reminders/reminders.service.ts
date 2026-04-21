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

  async requestReminderExecution(
    ruleId: string,
    recipientEmail: string,
  ): Promise<AdminReminderExecution> {
    const rule = await this.repository.getRule(ruleId);

    if (!rule) {
      throw new ReminderDomainError(`Reminder rule ${ruleId} was not found.`);
    }

    if (rule.status !== 'active') {
      throw new ReminderDomainError('Reminder execution requires an active rule.');
    }

    const dedupeKey = `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;
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
      await this.emailQueue.add(
        'send',
        { executionId: execution.id, recipientEmail, reportPeriod: rule.reportId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
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
    const nextCursor = startIndex + limit < all.length
      ? all[startIndex + limit - 1]!.id
      : null;

    return { items: page, nextCursor };
  }
}
