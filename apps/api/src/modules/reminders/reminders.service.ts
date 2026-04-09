import {
  adminReminderExecutionSchema,
  type AdminReminderExecution,
  type AdminReminderRule,
} from '@customreport/shared';

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
  constructor(private readonly repository: RemindersRepository) {}

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
      return adminReminderExecutionSchema.parse(existingExecution);
    }

    return this.repository.saveExecution(
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
  }

  async markReminderSent(executionId: string): Promise<AdminReminderExecution> {
    const execution = await this.repository.getExecution(executionId);

    if (!execution) {
      throw new ReminderDomainError(`Reminder execution ${executionId} was not found.`);
    }

    return this.repository.saveExecution(
      adminReminderExecutionSchema.parse({
        ...execution,
        status: 'sent',
        sentAt: new Date(),
      }),
    );
  }

  async listExecutions(ruleId: string): Promise<AdminReminderExecution[]> {
    return adminReminderExecutionSchema.array().parse(
      await this.repository.listExecutions(ruleId),
    );
  }
}
