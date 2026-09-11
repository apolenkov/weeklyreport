import { describe, expect, it, vi } from "vitest";

import {
  dueRuleFromRecipients,
  fakeOrganizationService,
  schedulerTestEnv,
} from "./__tests__/reminders-scheduler-harness.js";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

describe("RemindersScheduler — per-recipient isolation", () => {
  it("continues to the remaining recipients when one dispatch throws, reporting the failure", async () => {
    const recipients = [
      { userId: "u1", email: "first@test.local", name: "First" },
      { userId: "u2", email: "boom@test.local", name: "Boom" },
      { userId: "u3", email: "third@test.local", name: "Third" },
    ];
    const fakeRepository = {
      findDueDeadlineRules: vi.fn(() =>
        Promise.resolve([dueRuleFromRecipients(recipients)]),
      ),
      findDueEscalationRules: vi.fn(() => Promise.resolve([])),
    };
    const attempted: string[] = [];
    const serviceStub = {
      requestReminderExecutionWithOutcome: vi.fn(
        (_ruleId: string, email: string) => {
          attempted.push(email);
          return email === "boom@test.local"
            ? Promise.reject(new Error("dispatch exploded"))
            : Promise.resolve({
                execution: { id: email },
                outcome: "created" as const,
              });
        },
      ),
    };
    const scheduler = new RemindersScheduler(
      serviceStub as unknown as RemindersService,
      fakeRepository,
      fakeOrganizationService,
      schedulerTestEnv,
    );

    const result = await scheduler.runOnce(
      new Date("2026-04-19T16:00:00.000Z"),
    );

    expect(attempted).toEqual([
      "first@test.local",
      "boom@test.local",
      "third@test.local",
    ]);
    expect(result.requested).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      { recipientUserId: "u2", error: "dispatch exploded" },
    ]);
  });
});
