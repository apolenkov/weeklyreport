/**
 * P8 — Email dispatch integration test.
 *
 * Verifies that EmailReminderProcessor.processJob() sends a real SMTP
 * message through the local Mailpit catcher and that the message
 * arrives with the expected recipient and subject.
 *
 * Guard: if Mailpit is unreachable the tests self-skip inside each `it`
 * body with a clear console warning. `it.skipIf` cannot be used here
 * because the condition (`mailpitUp`) is resolved asynchronously in
 * `beforeAll` — by the time vitest registers test definitions the async
 * probe has not yet run, so the flag is always `false`. The self-skip
 * pattern below is the safe alternative.
 *
 * Transport: EmailService constructs the nodemailer transporter from
 * SMTP_HOST at instantiation time. Env vars are set before any import of
 * EmailService so the constructor picks up the real SMTP path.
 *
 * Worker bypass: EmailReminderProcessor.onModuleInit() opens a BullMQ
 * Worker which requires Redis. We skip onModuleInit and call the private
 * `processJob` directly via the same cast used in the unit tests.
 */

import type { Job } from "bullmq";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Decorator stubs — keep NestJS decorators inert in vitest (no DI container).
// ---------------------------------------------------------------------------
vi.mock("@nestjs/common", () => ({
  Injectable: () => (target: unknown) => target,
  OnModuleInit: class {},
  OnModuleDestroy: class {},
}));

vi.mock("bullmq", () => ({
  Worker: class {
    on() {}
    close() {
      return Promise.resolve();
    }
  },
}));

// ---------------------------------------------------------------------------
// Env — must happen before EmailService is imported so the constructor reads
// the real SMTP coordinates rather than falling back to jsonTransport.
// ---------------------------------------------------------------------------
process.env["SMTP_HOST"] = "localhost";
process.env["SMTP_PORT"] = "1025";
process.env["SMTP_FROM"] = "test-integration@customreport.local";

import {
  clearMessages,
  isMailpitUp,
  pollForMessage,
} from "../../test-utils/mailpit.js";
// ---------------------------------------------------------------------------
// Subject-under-test (imported after env + mocks are in place)
// ---------------------------------------------------------------------------
import { EmailReminderProcessor } from "../bullmq/email-reminder.processor.js";
import { EmailService } from "./email.service.js";

// ---------------------------------------------------------------------------
// Availability probe — resolved once before any test body runs.
// ---------------------------------------------------------------------------
let mailpitUp = false;

beforeAll(async () => {
  mailpitUp = await isMailpitUp();
  if (!mailpitUp) {
    console.warn(
      "[email-dispatch] Mailpit unreachable at http://localhost:8025 — start local stack to run live assertions.",
    );
  }
});

// ---------------------------------------------------------------------------
// Stable fixture values
// ---------------------------------------------------------------------------
const PERIOD = "2026-06-02 → 2026-06-08";
const ORG = { shortName: "TEST", fullName: "Test Organisation" };

// Stub RemindersService — only markReminderSent needs to resolve without error.
const remindersStub = {
  markReminderSent: vi.fn().mockResolvedValue(undefined),
};

// AdminService stub — null from-override; EmailService falls back to SMTP_FROM.
const adminStub = {
  getSettings: vi.fn().mockResolvedValue({ notificationFromEmail: null }),
};

// Private processJob access seam — mirrors the unit-test pattern.
type ProcessorSeam = {
  processJob(job: Job<unknown>): Promise<void>;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("email-dispatch integration (P8)", () => {
  it("deadline reminder: message arrives in Mailpit with correct recipient and subject", async (ctx) => {
    if (!mailpitUp) {
      ctx.skip();
      return;
    }

    // Use a unique recipient per run to avoid cross-talk with other messages.
    const recipient = `deadline-dispatch-${Date.now()}@test.local`;

    // Purge inbox before dispatching so we can assert on a clean slate.
    await clearMessages();

    const emailService = new EmailService();
    const processor = new EmailReminderProcessor(
      remindersStub as never,
      emailService,
      adminStub as never,
    );

    const executionId = `exec-integration-${Date.now()}`;

    const jobData = {
      executionId,
      recipientEmail: recipient,
      kind: "deadline" as const,
      leadName: "Integration Tester",
      reportPeriod: PERIOD,
      deadlineIso: new Date("2026-06-08T09:00:00.000Z").toISOString(),
      sectionUrl: "http://localhost:3000/lead/report?reportId=test",
      organization: ORG,
    };

    // Call processJob directly — bypasses BullMQ/Redis entirely.
    await (processor as unknown as ProcessorSeam).processJob({
      data: jobData,
    } as Job<unknown>);

    // Poll Mailpit until the message appears (up to 3 s).
    const message = await pollForMessage(recipient);

    expect(message).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- intentional non-null assertion (migrated from eslint-disable)
    const msg = message!;

    // Recipient
    expect(msg.To.some((a) => a.Address === recipient)).toBe(true);

    // Subject: "[TEST] Reminder: <period> report section due in 24h"
    expect(msg.Subject).toContain("[TEST]");
    expect(msg.Subject).toContain("Reminder:");
    expect(msg.Subject.toLowerCase()).toContain("report section due");

    // Processor must have marked the execution as sent.
    expect(remindersStub.markReminderSent).toHaveBeenCalledWith(executionId);
  });

  it("escalation reminder: message arrives in Mailpit addressed to head with escalation subject", async (ctx) => {
    if (!mailpitUp) {
      ctx.skip();
      return;
    }

    const headRecipient = `escalation-dispatch-${Date.now()}@test.local`;

    await clearMessages();

    const emailService = new EmailService();
    const processor = new EmailReminderProcessor(
      remindersStub as never,
      emailService,
      adminStub as never,
    );

    const executionId = `exec-escalation-${Date.now()}`;

    const jobData = {
      executionId,
      recipientEmail: headRecipient,
      kind: "escalation" as const,
      headName: "Head Tester",
      cycleDate: "2026-06-08",
      reportPeriod: PERIOD,
      lateLeads: [
        {
          leadName: "Late Lead",
          sectionTitle: "Q&A",
          deadlineIso: new Date("2026-06-08T09:00:00.000Z").toISOString(),
        },
      ],
      organization: ORG,
    };

    await (processor as unknown as ProcessorSeam).processJob({
      data: jobData,
    } as Job<unknown>);

    const message = await pollForMessage(headRecipient);
    expect(message).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- intentional non-null assertion (migrated from eslint-disable)
    const msg = message!;

    expect(msg.To.some((a) => a.Address === headRecipient)).toBe(true);
    // Subject: "[TEST] Action required: 1 late report section (2026-06-08)"
    expect(msg.Subject).toContain("[TEST]");
    expect(msg.Subject).toContain("Action required:");
    expect(msg.Subject).toContain("late report section");
  });
});
