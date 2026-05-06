import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// Mock NestJS common so decorators are no-ops in tests
vi.mock('@nestjs/common', () => ({
  Injectable: () => (target: unknown) => target,
  OnModuleInit: class {},
  OnModuleDestroy: class {},
}));

// Mock bullmq Worker so no Redis connection is attempted
vi.mock('bullmq', () => ({
  Worker: class {
    on() {}
    close() { return Promise.resolve(); }
  },
}));

// Mock services (and their transitive @customreport/shared dependency)
vi.mock('../../modules/reminders/reminders.service.js', () => ({
  RemindersService: class {
    markReminderSent = vi.fn();
  },
}));

vi.mock('../email/email.service.js', () => ({
  EmailService: class {
    sendMail = vi.fn();
  },
}));

import { EmailReminderProcessor } from './email-reminder.processor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRemindersService() {
  return {
    markReminderSent: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEmailService() {
  return {
    sendMail: vi.fn().mockResolvedValue(undefined),
  };
}

type EmailReminderJobData = {
  executionId: string;
  recipientEmail: string;
  reportPeriod: string;
};

function createMockJob(data: EmailReminderJobData): Job<EmailReminderJobData> {
  return { data } as Job<EmailReminderJobData>;
}

// Test seam — `processJob` is `private` on the class, but tests need to invoke
// it directly. Cast through this interface to call without `as any`.
type ProcessorTestSeam = {
  processJob(job: Job<EmailReminderJobData>): Promise<void>;
};

const defaultJobData: EmailReminderJobData = {
  executionId: 'exec-1',
  recipientEmail: 'lead@test.com',
  reportPeriod: '2026-04-07 – 2026-04-13',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailReminderProcessor.processJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends email with correct recipient and subject containing period', async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockEmail.sendMail).toHaveBeenCalledWith(
      'lead@test.com',
      'Reminder: Weekly Status Report Due',
      expect.stringContaining('2026-04-07'),
    );
  });

  it('marks reminder as sent after email succeeds', async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockReminders.markReminderSent).toHaveBeenCalledWith('exec-1');
  });

  it('does not mark sent if sendMail throws', async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    mockEmail.sendMail.mockRejectedValue(new Error('SMTP connection refused'));

    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail as never,
    );
    const job = createMockJob(defaultJobData);

    await expect((processor as unknown as ProcessorTestSeam).processJob(job)).rejects.toThrow(
      'SMTP connection refused',
    );

    expect(mockReminders.markReminderSent).not.toHaveBeenCalled();
  });
});
