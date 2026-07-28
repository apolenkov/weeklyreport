import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock NestJS common so decorators are no-ops in tests
vi.mock("@nestjs/common", () => ({
  Injectable: () => (target: unknown) => target,
}));

// Mock bullmq Worker so no Redis connection is attempted
vi.mock("bullmq", () => ({
  Worker: class {
    on() {
      /* intentionally empty: no-op event handler stub, prevents Redis connection in tests */
    }
    close() {
      return Promise.resolve();
    }
  },
}));

// Mock services (and their transitive @customreport/shared dependency)
vi.mock("../../modules/reminders/index.js", () => ({
  RemindersService: class {
    markReminderSent = vi.fn();
  },
}));

// SnapshotAdminService is an optional constructor dependency of
// EmailReminderProcessor. Mocking the module keeps the test isolated from
// Prisma + Nest DI.
vi.mock("../../modules/admin/index.js", () => ({
  SnapshotAdminService: class {
    getSettings = vi.fn();
  },
}));

// The deadline/escalation dispatch branches call renderEmail (react-email
// rendering); mocking it keeps these tests focused on the processor's
// dispatch wiring rather than template output.
vi.mock("../../modules/email/index.js", () => ({
  renderEmail: vi.fn(),
}));

import { renderEmail } from "../../modules/email/index.js";
import type { EnvConfig } from "../config/env.schema";
import {
  type EmailReminderJobData,
  EmailReminderProcessor,
} from "./email-reminder.processor.js";

// The processor reads env only in onModuleInit (not exercised here); a minimal
// stub satisfies the constructor for the processJob-focused tests.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

function createMockRemindersService() {
  return {
    claimExecutionForSending: vi.fn().mockResolvedValue(true),
    markReminderSent: vi.fn().mockResolvedValue(undefined),
    markReminderFailed: vi.fn().mockResolvedValue(undefined),
    releaseExecutionClaim: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEmailService() {
  return {
    sendMail: vi.fn().mockResolvedValue(undefined),
    sendMailMultipart: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSnapshotAdminService(
  notificationFromEmail: string | null = null,
) {
  return {
    getSettings: vi.fn().mockResolvedValue({
      notificationFromEmail,
    }),
  };
}

function createMockJob(
  data: EmailReminderJobData,
  attemptsMade = 0,
  attempts = 3,
): Job<EmailReminderJobData> {
  return {
    data,
    attemptsMade,
    opts: { attempts },
  } as Job<EmailReminderJobData>;
}

// Test seam — `processJob` is `private` on the class, but tests need to invoke
// it directly. Cast through this interface to call without `as any`.
interface ProcessorTestSeam {
  processJob(job: Job<EmailReminderJobData>): Promise<void>;
}

const defaultJobData: EmailReminderJobData = {
  executionId: "exec-1",
  recipientEmail: "lead@test.com",
  reportPeriod: "2026-04-07 – 2026-04-13",
};

const organizationBrand = {
  shortName: "Acme",
  fullName: "Acme Corp",
};

const deadlineJobData = {
  executionId: "exec-2",
  recipientEmail: "lead@test.com",
  kind: "deadline" as const,
  leadName: "Jane Lead",
  reportPeriod: "2026-04-07 – 2026-04-13",
  deadlineIso: "2026-04-14T18:00:00.000Z",
  sectionUrl: "https://app.example.com/reports/123",
  organization: organizationBrand,
};

const escalationJobData = {
  executionId: "exec-3",
  recipientEmail: "head@test.com",
  kind: "escalation" as const,
  headName: "Head Person",
  cycleDate: "2026-04-14",
  reportPeriod: "2026-04-07 – 2026-04-13",
  lateLeads: [
    {
      leadName: "Jane Lead",
      sectionTitle: "Team Alpha",
      deadlineIso: "2026-04-14T18:00:00.000Z",
    },
  ],
  organization: organizationBrand,
};

const renderedEmailFixture = {
  subject: "rendered subject",
  html: "<p>rendered html</p>",
  text: "rendered text",
};

describe("EmailReminderProcessor.processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with correct recipient and subject containing period", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    // A null setting delegates the final From-address choice to EmailService.
    expect(mockEmail.sendMail).toHaveBeenCalledWith(
      "lead@test.com",
      "Reminder: Weekly Status Report Due",
      expect.stringContaining("2026-04-07"),
      null,
    );
  });

  // When the settings service exposes a non-null notificationFromEmail,
  // the processor must forward that value to EmailService verbatim so
  // corporate SMTP relays see the configured From header.
  it("forwards AppSettings.notificationFromEmail as the From override", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const mockAdmin = createMockSnapshotAdminService("alerts@corp.example.com");
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      mockAdmin as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockAdmin.getSettings).toHaveBeenCalledTimes(1);
    expect(mockEmail.sendMail).toHaveBeenCalledWith(
      "lead@test.com",
      "Reminder: Weekly Status Report Due",
      expect.any(String),
      "alerts@corp.example.com",
    );
  });

  // Null notificationFromEmail is a valid admin choice (means "use env
  // default"). The processor passes null through — EmailService then
  // falls back to SMTP_FROM in its own resolution.
  it("passes through null notificationFromEmail unchanged (env fallback at EmailService boundary)", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const mockAdmin = createMockSnapshotAdminService(null);
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      mockAdmin as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockEmail.sendMail).toHaveBeenCalledWith(
      "lead@test.com",
      "Reminder: Weekly Status Report Due",
      expect.any(String),
      null,
    );
  });

  it("marks reminder as sent after email succeeds", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockReminders.markReminderSent).toHaveBeenCalledWith("exec-1");
  });

  it("does not mark sent if sendMail throws, and records a failed terminal state on the final attempt", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    mockEmail.sendMail.mockRejectedValue(new Error("SMTP connection refused"));

    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    // processJob's catch runs before BullMQ's moveToFailed increments
    // attemptsMade, so on the true final (3rd of 3) attempt the counter
    // still reads 2 — the +1 in the processor makes that terminal.
    const job = createMockJob(defaultJobData, 2, 3);

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("SMTP connection refused");

    expect(mockReminders.markReminderSent).not.toHaveBeenCalled();
    expect(mockReminders.markReminderFailed).toHaveBeenCalledWith(
      "exec-1",
      "SMTP connection refused",
    );
    expect(mockReminders.releaseExecutionClaim).not.toHaveBeenCalled();
  });

  // A non-terminal failure must release the claim (not mark failed) so the next
  // BullMQ attempt can re-claim. In processJob's catch the counter is
  // pre-increment: 0 = first attempt, 1 = penultimate of 3 — neither terminal.
  it.each([
    { attemptsMade: 0, label: "first attempt" },
    { attemptsMade: 1, label: "penultimate attempt, retry still pending" },
  ])(
    "releases the claim (not markReminderFailed) when a non-final attempt's dispatch fails ($label)",
    async ({ attemptsMade }) => {
      const mockReminders = createMockRemindersService();
      const mockEmail = createMockEmailService();
      mockEmail.sendMail.mockRejectedValue(
        new Error("SMTP connection refused"),
      );

      const processor = new EmailReminderProcessor(
        mockReminders as never,
        mockEmail,
        STUB_ENV,
        createMockSnapshotAdminService() as never,
      );
      const job = createMockJob(defaultJobData, attemptsMade, 3);

      await expect(
        (processor as unknown as ProcessorTestSeam).processJob(job),
      ).rejects.toThrow("SMTP connection refused");

      expect(mockReminders.releaseExecutionClaim).toHaveBeenCalledWith(
        "exec-1",
      );
      expect(mockReminders.markReminderFailed).not.toHaveBeenCalled();
    },
  );

  // If dispatch succeeds but the follow-up markReminderSent write throws
  // (e.g. a transient DB error), the email was already delivered: the row
  // must stay `sending`, not be marked failed or have its claim released.
  it("leaves the row sending (no failed mark, no claim release) when markReminderSent throws after a successful dispatch", async () => {
    const mockReminders = createMockRemindersService();
    mockReminders.markReminderSent.mockRejectedValue(
      new Error("DB write timed out"),
    );
    const mockEmail = createMockEmailService();

    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("DB write timed out");

    expect(mockReminders.markReminderFailed).not.toHaveBeenCalled();
    expect(mockReminders.releaseExecutionClaim).not.toHaveBeenCalled();
  });

  // Compare-and-set short-circuit: a retry (or duplicate worker, or admin
  // job.retry()) whose execution is no longer `queued` loses the claim and MUST
  // send nothing — the guard against double-delivery.
  it("short-circuits without sending when the execution is already claimed", async () => {
    const mockReminders = createMockRemindersService();
    mockReminders.claimExecutionForSending.mockResolvedValue(false);
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockEmail.sendMail).not.toHaveBeenCalled();
    expect(mockEmail.sendMailMultipart).not.toHaveBeenCalled();
    expect(mockReminders.markReminderSent).not.toHaveBeenCalled();
  });

  it("claims the execution before sending", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(mockReminders.claimExecutionForSending).toHaveBeenCalledWith(
      "exec-1",
    );
  });

  it('renders and sends the deadline template for kind: "deadline" jobs', async () => {
    vi.mocked(renderEmail).mockResolvedValue(renderedEmailFixture);
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(deadlineJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(renderEmail).toHaveBeenCalledWith({
      kind: "deadline",
      props: {
        leadName: deadlineJobData.leadName,
        reportPeriod: deadlineJobData.reportPeriod,
        deadlineIso: deadlineJobData.deadlineIso,
        sectionUrl: deadlineJobData.sectionUrl,
        organization: deadlineJobData.organization,
      },
    });
    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      deadlineJobData.recipientEmail,
      renderedEmailFixture.subject,
      renderedEmailFixture.html,
      renderedEmailFixture.text,
      null,
    );
  });

  it('renders and sends the escalation template for kind: "escalation" jobs', async () => {
    vi.mocked(renderEmail).mockResolvedValue(renderedEmailFixture);
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(escalationJobData);

    await (processor as unknown as ProcessorTestSeam).processJob(job);

    expect(renderEmail).toHaveBeenCalledWith({
      kind: "escalation",
      props: {
        headName: escalationJobData.headName,
        cycleDate: escalationJobData.cycleDate,
        reportPeriod: escalationJobData.reportPeriod,
        lateLeads: escalationJobData.lateLeads,
        organization: escalationJobData.organization,
      },
    });
    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      escalationJobData.recipientEmail,
      renderedEmailFixture.subject,
      renderedEmailFixture.html,
      renderedEmailFixture.text,
      null,
    );
  });
});
