import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { UNKNOWN_ERROR_MESSAGE } from "../../lib/error-message.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";

// Keep the real module surface so adding another Nest import cannot turn it
// into undefined; only the decorator needs to be inert for this unit.
vi.mock("@nestjs/common", async (importActual) => ({
  ...(await importActual<typeof import("@nestjs/common")>()),
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

// Mock services (and their transitive @weeklyreport/shared dependency)
vi.mock("../../modules/reminders/index.js", () => ({
  parseReminderQueueJobData: (data: unknown) => {
    if (
      typeof data !== "object" ||
      data === null ||
      !("contractVersion" in data) ||
      data.contractVersion !== 1 ||
      !("kind" in data) ||
      (data.kind !== "deadline" && data.kind !== "escalation")
    ) {
      throw new Error("Unsupported email reminder payload kind.");
    }
    return data;
  },
  RemindersService: class {
    markReminderSent = vi.fn();
  },
}));

// SnapshotAdminService is a required constructor dependency. Mocking its module
// keeps this processor unit isolated from Prisma and Nest DI.
vi.mock("../../modules/admin/index.js", () => ({
  SnapshotAdminService: class {
    getSettings = vi.fn();
  },
}));

// The deadline/escalation dispatch branches call renderEmail (HTML
// string templates); mocking it keeps these tests focused on the processor's
// dispatch wiring rather than template output.
vi.mock("../../modules/email/index.js", () => ({
  renderEmail: vi.fn(),
}));

import { renderEmail } from "../../modules/email/index.js";
import type { EnvConfig } from "../config/env.schema";
import type { EmailPort } from "../email/email.service.js";
import {
  type EmailReminderJobData,
  EmailReminderProcessor as ProductionEmailReminderProcessor,
} from "./email-reminder.processor.js";

class EmailReminderProcessor extends ProductionEmailReminderProcessor {
  constructor(
    reminders: ConstructorParameters<
      typeof ProductionEmailReminderProcessor
    >[0],
    email: ConstructorParameters<typeof ProductionEmailReminderProcessor>[1],
    env: EnvConfig,
    snapshot: ConstructorParameters<typeof ProductionEmailReminderProcessor>[3],
    logger: AppLogger = createNullLogger(),
  ) {
    super(reminders, email, env, snapshot, logger, null);
  }
}

// The processor reads env only in onModuleInit (not exercised here); a minimal
// stub satisfies the constructor for the processJob-focused tests.
const STUB_ENV = {
  REDIS_DB: 15,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
} as EnvConfig;

function createMockEmailService() {
  return {
    sendMail: vi.fn<EmailPort["sendMail"]>().mockResolvedValue(undefined),
    sendMailMultipart: vi
      .fn<EmailPort["sendMailMultipart"]>()
      .mockResolvedValue(undefined),
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

// Test seam — `processJob` is `protected` on the class, but tests need to invoke
// it directly. Cast through this interface to call without `as any`.
interface ProcessorTestSeam {
  processJob(job: Job<EmailReminderJobData>): Promise<void>;
}

interface FailureTestSeam {
  onJobFailed(job: Job<EmailReminderJobData> | undefined, error: Error): void;
}

type SpyLogger = AppLogger & {
  readonly warn: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
  readonly error: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
};

function makeSpyLogger(): SpyLogger {
  const logger: SpyLogger = {
    debug:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    info: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    error:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    child: () => logger,
  };
  return logger;
}

const organizationBrand = {
  shortName: "Acme",
  fullName: "Acme Corp",
};

const deadlineJobData = {
  contractVersion: 1 as const,
  executionId: "exec-1",
  recipientEmail: "lead@test.com",
  kind: "deadline" as const,
  cycleDate: "2026-04-14",
  leadName: "Jane Lead",
  reportPeriod: "2026-04-07 – 2026-04-13",
  deadlineIso: "2026-04-14T18:00:00.000Z",
  sectionUrl: "https://app.example.com/reports/123",
  organization: organizationBrand,
};

const defaultJobData: EmailReminderJobData = deadlineJobData;

const escalationJobData = {
  contractVersion: 1 as const,
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

function createMockRemindersService(
  durableData: EmailReminderJobData = defaultJobData,
) {
  return {
    claimExecutionForSending: vi.fn().mockResolvedValue(durableData),
    markReminderSent: vi.fn().mockResolvedValue(undefined),
    markReminderFailed: vi.fn().mockResolvedValue(undefined),
    releaseExecutionClaim: vi.fn().mockResolvedValue(undefined),
  };
}

describe("EmailReminderProcessor.processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderEmail).mockResolvedValue(renderedEmailFixture);
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
    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      "lead@test.com",
      renderedEmailFixture,
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
    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      "lead@test.com",
      renderedEmailFixture,
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

    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      "lead@test.com",
      renderedEmailFixture,
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
    mockEmail.sendMailMultipart.mockRejectedValue(
      new Error("SMTP connection refused"),
    );

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

  it.each([
    ["empty", new Error("")],
    ["whitespace-only", new Error(" \t ")],
  ] as const)(
    "uses a deterministic non-empty failure for a %s terminal SMTP error",
    async (_label, smtpError) => {
      const mockReminders = createMockRemindersService();
      const mockEmail = createMockEmailService();
      mockEmail.sendMailMultipart.mockRejectedValue(smtpError);
      const processor = new EmailReminderProcessor(
        mockReminders as never,
        mockEmail,
        STUB_ENV,
        createMockSnapshotAdminService() as never,
      );

      await expect(
        (processor as unknown as ProcessorTestSeam).processJob(
          createMockJob(defaultJobData, 2, 3),
        ),
      ).rejects.toBe(smtpError);
      expect(mockReminders.markReminderFailed).toHaveBeenCalledWith(
        "exec-1",
        UNKNOWN_ERROR_MESSAGE,
      );
      expect(mockReminders.releaseExecutionClaim).not.toHaveBeenCalled();
    },
  );

  // A non-terminal failure must release the claim (not mark failed) so the next
  // BullMQ attempt can re-claim. In processJob's catch the counter is
  // pre-increment; any value below `attempts` is non-terminal.
  it("releases the claim (not markReminderFailed) when a non-final attempt's dispatch fails", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    mockEmail.sendMailMultipart.mockRejectedValue(
      new Error("SMTP connection refused"),
    );

    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData, 1, 3);

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(job),
    ).rejects.toThrow("SMTP connection refused");

    expect(mockReminders.releaseExecutionClaim).toHaveBeenCalledWith("exec-1");
    expect(mockReminders.markReminderFailed).not.toHaveBeenCalled();
  });

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
    mockReminders.claimExecutionForSending.mockResolvedValue(null);
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

  it("rejects a pre-contract job before it can claim the execution", async () => {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const preContractJob = createMockJob({
      executionId: "pre-contract-exec",
      recipientEmail: "lead@test.com",
      reportPeriod: "2026-04-07 – 2026-04-13",
    } as unknown as EmailReminderJobData);

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob(preContractJob),
    ).rejects.toThrow();

    expect(mockReminders.claimExecutionForSending).not.toHaveBeenCalled();
    expect(mockEmail.sendMail).not.toHaveBeenCalled();
    expect(mockEmail.sendMailMultipart).not.toHaveBeenCalled();
    expect(mockReminders.markReminderSent).not.toHaveBeenCalled();
  });

  it("waits for the execution claim to resolve before sending", async () => {
    const mockReminders = createMockRemindersService();
    const { promise: claimPending, resolve: resolveClaim } =
      Promise.withResolvers<EmailReminderJobData>();
    mockReminders.claimExecutionForSending.mockReturnValue(claimPending);
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );
    const job = createMockJob(defaultJobData);

    const processing = (processor as unknown as ProcessorTestSeam).processJob(
      job,
    );

    expect(mockReminders.claimExecutionForSending).toHaveBeenCalledWith(
      "exec-1",
    );
    expect(mockEmail.sendMailMultipart).not.toHaveBeenCalled();

    resolveClaim(defaultJobData);
    await processing;

    expect(mockEmail.sendMailMultipart).toHaveBeenCalledOnce();
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
      {
        subject: renderedEmailFixture.subject,
        html: renderedEmailFixture.html,
        text: renderedEmailFixture.text,
      },
      null,
    );
  });

  it('renders and sends the escalation template for kind: "escalation" jobs', async () => {
    vi.mocked(renderEmail).mockResolvedValue(renderedEmailFixture);
    const mockReminders = createMockRemindersService(escalationJobData);
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
      {
        subject: renderedEmailFixture.subject,
        html: renderedEmailFixture.html,
        text: renderedEmailFixture.text,
      },
      null,
    );
  });

  it("renders the durable DB payload when an old failed job is retried after manual revival", async () => {
    const staleJobA: EmailReminderJobData = {
      ...deadlineJobData,
      recipientEmail: "old-recipient@test.com",
      leadName: "Old Lead",
      reportPeriod: "Old period",
      deadlineIso: "2026-04-14T18:00:00.000Z",
    };
    const durablePayloadB: EmailReminderJobData = {
      ...deadlineJobData,
      recipientEmail: "current-recipient@test.com",
      leadName: "Current Lead",
      reportPeriod: "Current period",
      deadlineIso: "2026-04-21T18:00:00.000Z",
    };
    const mockReminders = createMockRemindersService(durablePayloadB);
    const mockEmail = createMockEmailService();
    const processor = new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
    );

    await (processor as unknown as ProcessorTestSeam).processJob(
      createMockJob(staleJobA),
    );

    expect(renderEmail).toHaveBeenCalledWith({
      kind: "deadline",
      props: {
        leadName: durablePayloadB.leadName,
        reportPeriod: durablePayloadB.reportPeriod,
        deadlineIso: durablePayloadB.deadlineIso,
        sectionUrl: durablePayloadB.sectionUrl,
        organization: durablePayloadB.organization,
      },
    });
    expect(mockEmail.sendMailMultipart).toHaveBeenCalledWith(
      durablePayloadB.recipientEmail,
      {
        subject: renderedEmailFixture.subject,
        html: renderedEmailFixture.html,
        text: renderedEmailFixture.text,
      },
      null,
    );
    expect(
      mockEmail.sendMailMultipart.mock.calls.map(([recipient]) => recipient),
    ).not.toContain(staleJobA.recipientEmail);
  });
});

describe("EmailReminderProcessor.onJobFailed — traceparent validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProcessorWithLogger(logger: AppLogger) {
    const mockReminders = createMockRemindersService();
    const mockEmail = createMockEmailService();
    return new EmailReminderProcessor(
      mockReminders as never,
      mockEmail,
      STUB_ENV,
      createMockSnapshotAdminService() as never,
      logger,
    );
  }

  it("warns loudly when a failed job carries a malformed traceparent", () => {
    const logger = makeSpyLogger();
    const processor = makeProcessorWithLogger(logger);

    (processor as unknown as FailureTestSeam).onJobFailed(
      createMockJob({ ...defaultJobData, traceparent: "00-abc-123-01" }),
      new Error("SMTP down"),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "email-reminder job failed with malformed traceparent",
      expect.objectContaining({ traceparent: "00-abc-123-01" }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "email-reminder job failed",
      expect.not.objectContaining({ traceId: "abc" }),
    );
  });

  it("does not warn about the traceparent when the carrier is valid", () => {
    const logger = makeSpyLogger();
    const processor = makeProcessorWithLogger(logger);
    const validTraceparent =
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

    (processor as unknown as FailureTestSeam).onJobFailed(
      createMockJob({ ...defaultJobData, traceparent: validTraceparent }),
      new Error("SMTP down"),
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "email-reminder job failed",
      expect.objectContaining({
        traceId: "0af7651916cd43dd8448eb211c80319c",
      }),
    );
  });
});
