import type { AdminReminderExecution, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  activeRule,
  createServiceRepo,
  dueRuleFromRecipients,
  fakeOrganizationService,
  reportDeadline,
  reportId,
  ruleId,
  schedulerTestEnv,
} from "./__tests__/reminders-scheduler-harness.js";
import { RemindersScheduler } from "./reminders.scheduler.js";
import { RemindersService } from "./reminders.service.js";
import type { DueEscalationRule } from "./reminders.types.js";
import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

const recipients = [
  {
    userId: "alice",
    email: "alice@test.local",
    name: "Alice",
    notificationOptOut: false,
  },
  {
    userId: "bob",
    email: "bob@test.local",
    name: "Bob",
    notificationOptOut: false,
  },
];
const session: UserSession = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  email: "head@test.local",
  name: "Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

function createDispatchHarness(kind: "deadline" | "escalation" = "deadline") {
  const executions = new Map<string, AdminReminderExecution>();
  const failingEmails = new Set(["alice@test.local"]);
  const repository = createServiceRepo({
    getRule: () => Promise.resolve({ ...activeRule, kind }),
    getRulePeriodLabel: () => Promise.resolve("2026-04-13 → 2026-04-19"),
    findInScopeSectionId: () => Promise.resolve("section"),
    findActiveRuleForDispatch: () =>
      Promise.resolve({
        id: ruleId,
        fireAt: activeRule.fireAt,
        deadline: reportDeadline,
      }),
    findDraftSectionsForDispatch: () =>
      Promise.resolve([
        ...recipients,
        {
          email: "opt-out@test.local",
          name: "Opted out",
          notificationOptOut: true,
        },
      ]),
    insertExecutionOnConflict: (candidate, _payload, allowFailedRevival) => {
      const previous = executions.get(candidate.dedupeKey);
      if (!previous) {
        executions.set(candidate.dedupeKey, candidate);
        return Promise.resolve({ execution: candidate, outcome: "created" });
      }
      if (previous.status === "failed" && allowFailedRevival) {
        const execution = { ...candidate, id: previous.id };
        executions.set(candidate.dedupeKey, execution);
        return Promise.resolve({ execution, outcome: "revived" });
      }
      return Promise.resolve({ execution: previous, outcome: "deduplicated" });
    },
    markExecutionFailed: (id, errorMessage) => {
      const execution = [...executions.values()].find((row) => row.id === id);
      if (!execution)
        throw new Error("Failure write addressed an unknown execution");
      executions.set(execution.dedupeKey, {
        ...execution,
        status: "failed",
        errorMessage,
      });
      return Promise.resolve();
    },
  });
  const enqueue = vi.fn((_id: string, data: ReminderQueueJobData) =>
    failingEmails.has(data.recipientEmail)
      ? Promise.reject(new Error("Queue unavailable"))
      : Promise.resolve(),
  );
  const service = new RemindersService(
    repository,
    undefined,
    { enqueue },
    undefined,
    fakeOrganizationService,
    schedulerTestEnv,
  );
  return { executions, failingEmails, enqueue, service, repository };
}

describe("composed reminder dispatch outcomes", () => {
  it("retains other recipients when recording a queue failure also rejects", async () => {
    const { service, repository, enqueue } = createDispatchHarness();
    vi.spyOn(repository, "markExecutionFailed").mockRejectedValue(
      new Error("Persistence unavailable"),
    );
    await expect(
      service.scope.dispatchPendingReminders(session, reportId, ruleId),
    ).resolves.toEqual({
      queued: 1,
      alreadyRequested: 0,
      failed: 1,
      skipped: 1,
    });
    expect(enqueue.mock.calls.map(([, data]) => data.recipientEmail)).toEqual([
      "alice@test.local",
      "bob@test.local",
    ]);
  });

  it("retains mixed results and retries only the failed recipient", async () => {
    const { service, executions, enqueue, failingEmails } =
      createDispatchHarness();
    await expect(
      service.scope.dispatchPendingReminders(session, reportId, ruleId),
    ).resolves.toEqual({
      queued: 1,
      alreadyRequested: 0,
      failed: 1,
      skipped: 1,
    });
    expect(enqueue.mock.calls.map(([, data]) => data.recipientEmail)).toEqual([
      "alice@test.local",
      "bob@test.local",
    ]);
    const failed = [...executions.values()].find(
      (row) => row.recipientEmail === "alice@test.local",
    );
    expect(failed).toMatchObject({
      status: "failed",
      errorMessage: "Queue unavailable",
    });

    // A failed manual revival must stay failed rather than enter the success tally.
    await expect(
      service.scope.dispatchPendingReminders(session, reportId, ruleId),
    ).resolves.toEqual({
      queued: 0,
      alreadyRequested: 1,
      failed: 1,
      skipped: 1,
    });
    failingEmails.clear();
    await expect(
      service.scope.dispatchPendingReminders(session, reportId, ruleId),
    ).resolves.toEqual({
      queued: 1,
      alreadyRequested: 1,
      failed: 0,
      skipped: 1,
    });
    expect(executions.size).toBe(2);
    expect(
      [...executions.values()].find((row) => row.id === failed?.id),
    ).toMatchObject({ status: "queued", errorMessage: null });
    expect(enqueue.mock.calls.map(([, data]) => data.recipientEmail)).toEqual([
      "alice@test.local",
      "bob@test.local",
      "alice@test.local",
      "alice@test.local",
    ]);
  });

  it("reports a completely failed manual batch without successful requests", async () => {
    const { service, failingEmails } = createDispatchHarness();
    failingEmails.add("bob@test.local");
    await expect(
      service.scope.dispatchPendingReminders(session, reportId, ruleId),
    ).resolves.toEqual({
      queued: 0,
      alreadyRequested: 0,
      failed: 2,
      skipped: 1,
    });
  });

  it.each(["deadline", "escalation"] as const)(
    "counts %s enqueue failures and continues to the next recipient",
    async (kind) => {
      const { service, enqueue } = createDispatchHarness(kind);
      const escalation: DueEscalationRule = {
        id: ruleId,
        reportId,
        fireAt: activeRule.fireAt,
        reportPeriodLabel: "2026-04-13 → 2026-04-19",
        groups: recipients.map(({ userId, email, name }) => ({
          head: { userId, email, name },
          lateLeads: [
            {
              leadName: "Late Lead",
              sectionTitle: "Engineering",
              deadlineIso: reportDeadline.toISOString(),
            },
          ],
        })),
      };
      const dueRepository = {
        findDueDeadlineRules: () =>
          Promise.resolve(
            kind === "deadline" ? [dueRuleFromRecipients(recipients)] : [],
          ),
        findDueEscalationRules: () =>
          Promise.resolve(kind === "escalation" ? [escalation] : []),
      };
      const scheduler = new RemindersScheduler(
        service,
        dueRepository,
        fakeOrganizationService,
        schedulerTestEnv,
      );
      const expected = {
        requested: 1,
        failed: 1,
        failures: [{ recipientUserId: "alice", error: "Queue unavailable" }],
      };
      await expect(
        scheduler.runOnce(new Date("2026-04-19T16:00:00.000Z")),
      ).resolves.toEqual(expected);
      expect(enqueue).toHaveBeenCalledTimes(2);
      // Automatic retry observes the terminal failure without reviving or counting it as requested.
      await expect(
        scheduler.runOnce(new Date("2026-04-19T17:00:00.000Z")),
      ).resolves.toEqual(expected);
      expect(enqueue).toHaveBeenCalledTimes(2);
    },
  );
});
