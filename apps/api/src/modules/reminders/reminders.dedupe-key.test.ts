import type {
  AdminReminderExecution,
  AdminReminderRule,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { RemindersService } from "./reminders.service";
import type { RemindersRepository } from "./reminders.types";
import {
  buildReminderDedupeKey,
  resolveReminderDedupeKey,
  toReminderCycleDate,
} from "./reminders-dedupe-key.js";
import { extractRecipientEmail } from "./reminders-row-mappers";
import { unusedRemindersScopeStubs } from "./reminders-scope.repository-stub.js";

/**
 * Dedupe-key recipient extraction regression.
 *
 * Pre-fix the legacy regex `/Z:(.+)$/` matched only the v2.0 ISO-suffixed
 * shape and silently returned '' for the newer keyed shapes. Both shapes
 * must round-trip the recipient email correctly.
 */
describe("extractRecipientEmail", () => {
  it("parses legacy v2.0 shape: ruleId:<ISO with Z>:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:2026-04-12T10:00:00.000Z:user@example.com";
    expect(extractRecipientEmail(key)).toBe("user@example.com");
  });

  it("parses the newer deadline shape: ruleId:deadline:YYYY-MM-DD:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:deadline:2026-04-12:lead1@customreport.local";
    expect(extractRecipientEmail(key)).toBe("lead1@customreport.local");
  });

  it("parses the newer escalation shape: ruleId:escalation:YYYY-MM-DD:email", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:escalation:2026-04-12:head@customreport.local";
    expect(extractRecipientEmail(key)).toBe("head@customreport.local");
  });

  it("parses the newer follow_up shape (kind contains underscore but no colon)", () => {
    const key =
      "66666666-6666-4666-8666-666666666666:follow_up:2026-04-12:user@example.com";
    expect(extractRecipientEmail(key)).toBe("user@example.com");
  });

  it("returns empty string when last segment is not an email shape", () => {
    expect(extractRecipientEmail("rule:deadline:2026-04-12:not-an-email")).toBe(
      "",
    );
  });

  it("returns empty string for an unparseable / empty key", () => {
    expect(extractRecipientEmail("")).toBe("");
    expect(extractRecipientEmail("garbage")).toBe("");
  });

  it("rejects whitespace and colon characters in the local-part", () => {
    expect(extractRecipientEmail("rule:foo:bar baz@example.com")).toBe("");
  });
});

/**
 * Cross-caller dedupe-key divergence regression.
 *
 * Pre-fix, `RemindersScopeService.dispatchDraftSections` built its own
 * `${ruleId}:${fireAt.toISOString()}:${email}` key (and called
 * `requestReminderExecution` with no payload, which built that same legacy
 * shape internally) while `RemindersScheduler.dispatchRule` supplied a
 * `{ kind: "deadline", cycleDate, ... }` payload, which built
 * `${ruleId}:deadline:${cycleDate}:${email}`. The two shapes could never
 * collide for the same rule/recipient/cycle, so a manual head "Remind" after
 * an automated deadline send always inserted a second execution and sent a
 * duplicate email.
 */
describe("resolveReminderDedupeKey — cross-caller divergence regression", () => {
  const rule = {
    id: "66666666-6666-4666-8666-666666666666",
    fireAt: new Date("2026-04-12T09:00:00.000Z"),
  };
  const recipientEmail = "lead1@customreport.local";
  const cycleDate = toReminderCycleDate(rule.fireAt);

  it("a no-payload manual dispatch key is byte-identical to the scheduler's deadline-payload key for the same cycle", () => {
    const manualKey = resolveReminderDedupeKey(rule, recipientEmail);
    const schedulerKey = resolveReminderDedupeKey(rule, recipientEmail, {
      kind: "deadline",
      cycleDate,
    });

    expect(manualKey).toBe(schedulerKey);
    expect(manualKey).toBe(
      buildReminderDedupeKey({
        ruleId: rule.id,
        kind: "deadline",
        cycleDate,
        recipientEmail,
      }),
    );
  });

  it("documents the pre-fix legacy shape as no longer reachable from either caller", () => {
    const legacyShape = `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;
    const unifiedShape = resolveReminderDedupeKey(rule, recipientEmail);

    expect(unifiedShape).not.toBe(legacyShape);
  });
});

/**
 * End-to-end regression: a manual head "Remind" for a rule/lead/cycle that
 * already received the automated deadline reminder must report
 * `alreadySent`, not insert a second `ReminderExecution` row / send a
 * duplicate email.
 */
describe("RemindersScopeService.dispatchDraftSections — manual dispatch after an automated send (regression)", () => {
  const REPORT_ID = "22222222-2222-4222-8222-222222222222";
  const rule: AdminReminderRule = {
    id: "66666666-6666-4666-8666-666666666666",
    reportId: REPORT_ID,
    kind: "deadline",
    fireAt: new Date("2026-04-12T09:00:00.000Z"),
    timezone: "Europe/Moscow",
    status: "active",
    version: 1,
    policyId: null,
  };
  const recipientEmail = "lead1@customreport.local";
  const adminSession: UserSession = {
    userId: "00000000-0000-4000-8000-0000000000ad",
    email: "admin@customreport.local",
    name: "Platform Admin",
    role: "admin",
    activeReportId: REPORT_ID,
    activeReportSectionId: null,
  };

  function buildDispatchRepository(): RemindersRepository {
    const executions = new Map<string, AdminReminderExecution>();
    const createdAtByDedupeKey = new Map<string, Date>();

    return {
      ...unusedRemindersScopeStubs(),
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async getRule(ruleId: string) {
        return ruleId === rule.id ? structuredClone(rule) : null;
      },
      getRulePeriodLabel: () => Promise.resolve("2026-04-07 → 2026-04-13"),
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async findExecutionByDedupeKey(dedupeKey: string) {
        for (const execution of executions.values()) {
          if (execution.dedupeKey === dedupeKey)
            return structuredClone(execution);
        }
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async insertExecutionOnConflict(candidate: AdminReminderExecution) {
        for (const existing of executions.values()) {
          if (existing.dedupeKey === candidate.dedupeKey) {
            return { execution: structuredClone(existing), inserted: false };
          }
        }
        executions.set(candidate.id, structuredClone(candidate));
        createdAtByDedupeKey.set(candidate.dedupeKey, new Date());
        return { execution: structuredClone(candidate), inserted: true };
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async saveExecution(execution: AdminReminderExecution) {
        executions.set(execution.id, structuredClone(execution));
        return structuredClone(execution);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async getExecution(executionId: string) {
        const execution = executions.get(executionId);
        return execution ? structuredClone(execution) : null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async listExecutions(ruleId: string) {
        return [...executions.values()].filter((e) => e.ruleId === ruleId);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async findActiveRuleForDispatch(reportId: string) {
        return reportId === rule.reportId
          ? { id: rule.id, fireAt: rule.fireAt }
          : null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async findDraftSectionsForDispatch() {
        return [{ email: recipientEmail, notificationOptOut: false }];
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- stub implements the async RemindersRepository contract (no awaitable work here)
      async findExecutionCreatedAt(dedupeKey: string) {
        return createdAtByDedupeKey.get(dedupeKey) ?? null;
      },
    };
  }

  it("reports alreadySent (not a new dispatch) for a manual Remind following the automated cycle send", async () => {
    const service = new RemindersService(buildDispatchRepository());
    const cycleDate = toReminderCycleDate(rule.fireAt);

    // The scheduler's automated T-24h tick.
    await service.requestReminderExecution(rule.id, recipientEmail, {
      kind: "deadline",
      cycleDate,
      leadName: "Lead One",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: rule.fireAt.toISOString(),
      sectionUrl: "http://localhost:3000/lead/report?reportId=x",
      organization: {
        shortName: "Demo",
        fullName: "Example Software Department",
      },
    });

    // Guarantees the automated insert's `createdAt` clock reading is strictly
    // before the manual dispatch's read-back window (`beforeMs`) — both calls
    // otherwise resolve within the same millisecond in this in-memory test.
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Head clicks manual "Remind" for the same rule/lead within the same cycle.
    const result = await service.scope.dispatchPendingReminders(
      adminSession,
      REPORT_ID,
    );

    expect(result.dispatched).toBe(0);
    expect(result.alreadySent).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
