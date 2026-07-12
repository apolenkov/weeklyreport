import type { AdminReminderExecution } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import type { RemindersPrismaRepository } from "./reminders.prisma-repository";
import type { RemindersService } from "./reminders.service";
import { RemindersReaperScheduler } from "./reminders-reaper.scheduler";

function makeExecution(
  id: string,
  status: AdminReminderExecution["status"],
): AdminReminderExecution {
  return {
    id,
    ruleId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    dedupeKey: `key-${id}`,
    status,
    scheduledFor: new Date("2026-04-11T09:00:00.000Z"),
    sentAt: null,
    recipientEmail: `${id}@test.local`,
    errorMessage: null,
  };
}

describe("RemindersReaperScheduler", () => {
  it("re-enqueues every stuck queued execution the lister returns", async () => {
    const stuck = [makeExecution("a", "queued"), makeExecution("b", "queued")];
    const repository = {
      listStuckQueuedExecutions: vi.fn(() => Promise.resolve(stuck)),
    } as unknown as RemindersPrismaRepository;
    const reEnqueued: string[] = [];
    const service = {
      reEnqueueStuckExecution: vi.fn((e: AdminReminderExecution) => {
        reEnqueued.push(e.id);
        return Promise.resolve();
      }),
    } as unknown as RemindersService;
    const reaper = new RemindersReaperScheduler(service, repository);

    await reaper.runOnce(new Date("2026-04-11T12:00:00.000Z"));

    expect(reEnqueued).toEqual(["a", "b"]);
  });

  it("isolates a re-enqueue failure so the remaining executions still run", async () => {
    const stuck = [
      makeExecution("ok1", "queued"),
      makeExecution("boom", "queued"),
      makeExecution("ok2", "queued"),
    ];
    const repository = {
      listStuckQueuedExecutions: vi.fn(() => Promise.resolve(stuck)),
    } as unknown as RemindersPrismaRepository;
    const attempted: string[] = [];
    const service = {
      reEnqueueStuckExecution: vi.fn((e: AdminReminderExecution) => {
        attempted.push(e.id);
        return e.id === "boom"
          ? Promise.reject(new Error("re-enqueue exploded"))
          : Promise.resolve();
      }),
    } as unknown as RemindersService;
    const reaper = new RemindersReaperScheduler(service, repository);

    await reaper.runOnce(new Date("2026-04-11T12:00:00.000Z"));

    expect(attempted).toEqual(["ok1", "boom", "ok2"]);
  });

  it("queries executions older than the stuck timeout", async () => {
    const lister = vi.fn((_olderThan: Date) =>
      Promise.resolve([] as AdminReminderExecution[]),
    );
    const repository = {
      listStuckQueuedExecutions: lister,
    } as unknown as RemindersPrismaRepository;
    const service = {
      reEnqueueStuckExecution: vi.fn(() => Promise.resolve()),
    } as unknown as RemindersService;
    const reaper = new RemindersReaperScheduler(service, repository);

    const now = new Date("2026-04-11T12:00:00.000Z");
    await reaper.runOnce(now);

    // The cutoff is strictly in the past — a just-created queued row is safe.
    const cutoff = expectDefined(lister.mock.calls[0])[0];
    expect(cutoff.getTime()).toBeLessThan(now.getTime());
  });
});
