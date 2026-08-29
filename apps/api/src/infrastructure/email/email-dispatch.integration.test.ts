// it.skipIf cannot gate on mailpitUp — the async probe runs in beforeAll after
// vitest registers tests, so each `it` self-skips when Mailpit is unreachable.

import type { Job } from "bullmq";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@nestjs/common", () => ({
  Injectable: () => (target: unknown) => target,
  // ConfigModule (imported transitively via email.service.ts → config.module.ts)
  // uses @Module; EmailService's constructor uses @Inject. Both are inert here.
  Module: () => (target: unknown) => target,
  Inject: () => () => undefined,
}));

vi.mock("bullmq", () => ({
  Worker: class {
    on() {
      /* intentionally empty: BullMQ Worker.on stub — event subscriptions are not exercised in this integration test */
    }
    close() {
      return Promise.resolve();
    }
  },
}));

import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  clearMessages,
  isMailpitUp,
  pollForMessage,
} from "../../test-utils/mailpit.js";
import { EmailReminderProcessor as ProductionEmailReminderProcessor } from "../bullmq/email-reminder.processor.js";
import type { EnvConfig } from "../config/env.schema.js";
import { EmailService } from "./email.service.js";

class EmailReminderProcessor extends ProductionEmailReminderProcessor {
  constructor(
    reminders: ConstructorParameters<
      typeof ProductionEmailReminderProcessor
    >[0],
    email: ConstructorParameters<typeof ProductionEmailReminderProcessor>[1],
    env: EnvConfig,
    snapshot: ConstructorParameters<typeof ProductionEmailReminderProcessor>[3],
  ) {
    super(reminders, email, env, snapshot, createNullLogger(), null);
  }
}

// Real SMTP coords so EmailService picks Mailpit; Redis coords satisfy the
// processor constructor (onModuleInit is skipped — processJob is called directly).
const SMTP_ENV = {
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_FROM: "test-integration@customreport.local",
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_DB: 15,
} as unknown as EnvConfig;

let mailpitUp = false;
const REQUIRED_INTEGRATION_DEPS =
  process.env.REQUIRED_INTEGRATION_DEPS === "true";

beforeAll(async () => {
  mailpitUp = await isMailpitUp();
  if (!mailpitUp) {
    if (REQUIRED_INTEGRATION_DEPS) {
      throw new Error(
        "Required integration dependency unavailable: Mailpit at http://localhost:8025",
      );
    }
    console.warn(
      "[email-dispatch] Mailpit unreachable at http://localhost:8025 — start local stack to run live assertions.",
    );
  }
});

const PERIOD = "2026-06-02 → 2026-06-08";
const ORG = { shortName: "TEST", fullName: "Test Organisation" };

// Transport test: worker that wins the atomic send claim, then records delivery.
const remindersStub = {
  claimExecutionForSending: vi.fn().mockResolvedValue(true),
  markReminderSent: vi.fn().mockResolvedValue(undefined),
};

// Null from-override; EmailService uses SMTP_FROM.
const adminStub = {
  getSettings: vi.fn().mockResolvedValue({ notificationFromEmail: null }),
};

// Private processJob access seam — mirrors the unit-test pattern.
interface ProcessorSeam {
  processJob(job: Job<unknown>): Promise<void>;
}

// Local OrbStack port-forwarding holds a server-speaks-first protocol's opening
// byte (the SMTP 220 banner) for ~8-10s regardless of port; each SMTP dispatch
// therefore needs headroom well beyond the default 5s per-test budget.
const SMTP_GREETING_HEADROOM_MS = 30_000;

describe("email-dispatch integration", () => {
  it(
    "deadline reminder: message arrives in Mailpit with correct recipient and subject",
    { timeout: SMTP_GREETING_HEADROOM_MS },
    async (ctx) => {
      if (!mailpitUp) {
        if (REQUIRED_INTEGRATION_DEPS) {
          throw new Error(
            "Required integration dependency unavailable: Mailpit",
          );
        }
        ctx.skip();
        return;
      }

      const recipient = `deadline-dispatch-${Date.now()}@test.local`;

      await clearMessages();

      const emailService = new EmailService(SMTP_ENV);
      const processor = new EmailReminderProcessor(
        remindersStub as never,
        emailService,
        SMTP_ENV,
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

      await (processor as unknown as ProcessorSeam).processJob({
        data: jobData,
      } as Job<unknown>);

      const message = await pollForMessage(recipient);

      const msg = expectDefined(message);

      expect(msg.To.some((a) => a.Address === recipient)).toBe(true);

      expect(msg.Subject).toContain("[TEST]");
      expect(msg.Subject).toContain("Reminder:");
      expect(msg.Subject.toLowerCase()).toContain("report section due");

      expect(remindersStub.markReminderSent).toHaveBeenCalledWith(executionId);
    },
  );

  it(
    "escalation reminder: message arrives in Mailpit addressed to head with escalation subject",
    { timeout: SMTP_GREETING_HEADROOM_MS },
    async (ctx) => {
      if (!mailpitUp) {
        if (REQUIRED_INTEGRATION_DEPS) {
          throw new Error(
            "Required integration dependency unavailable: Mailpit",
          );
        }
        ctx.skip();
        return;
      }

      const headRecipient = `escalation-dispatch-${Date.now()}@test.local`;

      await clearMessages();

      const emailService = new EmailService(SMTP_ENV);
      const processor = new EmailReminderProcessor(
        remindersStub as never,
        emailService,
        SMTP_ENV,
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
      const msg = expectDefined(message);

      expect(msg.To.some((a) => a.Address === headRecipient)).toBe(true);
      expect(msg.Subject).toContain("[TEST]");
      expect(msg.Subject).toContain("Action required:");
      expect(msg.Subject).toContain("late report section");
      expect(remindersStub.markReminderSent).toHaveBeenCalledWith(executionId);
    },
  );
});
