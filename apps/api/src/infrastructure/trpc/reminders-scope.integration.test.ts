import { TRPCError } from "@trpc/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { RemindersPrismaRepository } from "../../modules/reminders/index.js";
import { RemindersService } from "../../modules/reminders/index.js";
import { WeeklyReportPrismaRepository } from "../../modules/weekly-report/index.js";
import { WeeklyReportService } from "../../modules/weekly-report/index.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * Per-group authorization for the three reminder procedures (real DB). A
 * group-A head must not execute, list, or dispatch reminders against another
 * group's rule / report / lead, nor send to an arbitrary email; admin keeps
 * god-mode. Driven through the real router → real RemindersService → real
 * Prisma so the router's scope threading is exercised end to end.
 */

const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const LEAD_A2 = "a0000000-0000-4000-a000-0000000000a2";
const SECTION_B_ON_A = "b0000000-0000-4000-8000-0000000000b3";
const REPORT_B = TEST_IDS.targetReport;
const SECTION_B_ON_B = "b0000000-0000-4000-8000-0000000000b4";
const RULE_A = TEST_IDS.reminderRule;
const RULE_B = "b0000000-0000-4000-8000-0000000000b5";
const FIRE_AT = new Date("2026-04-11T09:00:00.000Z");

const LEAD_A_EMAIL = "lead1@test.local"; // seedTestData lead, group A
const LEAD_B_EMAIL = "lead-b@test.local";
const HEAD_A_EMAIL = "head@test.local";

type Role = "head" | "admin";

function makeSession(role: Role, activeReportId: string | null) {
  return {
    userId: role === "admin" ? LEAD_A2 : TEST_IDS.head,
    email: role === "admin" ? "admin@test.local" : HEAD_A_EMAIL,
    name: `${role} user`,
    role,
    reportingGroupId: TEST_IDS.group,
    viewerGroupAccess: [TEST_IDS.group],
    activeReportId,
    activeReportSectionId: null,
  };
}

const prisma = createTestPrisma();

function buildCaller(role: Role, activeReportId: string | null) {
  const repo = new RemindersPrismaRepository(prisma as never);
  const remindersService = new RemindersService(repo);
  const weeklyReportService = new WeeklyReportService(
    new WeeklyReportPrismaRepository(prisma as never),
  );
  const deps = {
    prisma,
    remindersService,
    weeklyReportService,
  } as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: makeSession(role, activeReportId),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

function dedupeKey(ruleId: string, email: string): string {
  return `${ruleId}:${FIRE_AT.toISOString()}:${email}`;
}

describe("reminders namespace — per-group scope (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
    const data = await seedTestData(prisma);

    // Group B + its lead, plus a second in-scope group-A lead with NO section.
    await prisma.reportingGroup.create({
      data: { id: GROUP_B, name: "Group B", description: "Other group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD_B,
        email: LEAD_B_EMAIL,
        name: "Lead B",
        lastName: "B",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-b",
        reportingGroupId: GROUP_B,
      },
    });
    await prisma.user.create({
      data: {
        id: LEAD_A2,
        email: "lead-a2@test.local",
        name: "Lead A2",
        lastName: "A2",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-a2",
        reportingGroupId: TEST_IDS.group,
      },
    });

    // Shared report A (TEST_IDS.report) gains a group-B draft section.
    await prisma.reportSection.create({
      data: {
        id: SECTION_B_ON_A,
        reportId: data.report.id,
        authorId: LEAD_B,
        status: "draft",
      },
    });

    // Group-B-only report B with a group-B draft section.
    await prisma.report.create({
      data: {
        id: REPORT_B,
        // Deliberately BEFORE the shared report A's period (2026-04-07) so
        // report A stays the DB-resolved current editable period across this
        // suite — dispatchPending's gate now compares against that resolved
        // value, not the caller-supplied `activeReportId` fixture argument.
        periodStart: new Date("2026-03-24"),
        periodEnd: new Date("2026-03-30"),
        deadline: new Date("2026-03-28"),
        status: "draft",
      },
    });
    await prisma.reportSection.create({
      data: {
        id: SECTION_B_ON_B,
        reportId: REPORT_B,
        authorId: LEAD_B,
        status: "draft",
      },
    });

    // Active rules: A on the shared report, B on the group-B report.
    await prisma.reminderRule.createMany({
      data: [
        {
          id: RULE_A,
          kind: "deadline",
          fireAt: FIRE_AT,
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          reportId: data.report.id,
        },
        {
          id: RULE_B,
          kind: "deadline",
          fireAt: FIRE_AT,
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          reportId: REPORT_B,
        },
      ],
    });

    // Rule A executions for BOTH groups' authors (the mixed-scope slice).
    await prisma.reminderExecution.createMany({
      data: [
        {
          id: TEST_IDS.reminderExec1,
          ruleId: RULE_A,
          dedupeKey: dedupeKey(RULE_A, LEAD_A_EMAIL),
          status: "pending",
        },
        {
          id: TEST_IDS.reminderExec2,
          ruleId: RULE_A,
          dedupeKey: dedupeKey(RULE_A, LEAD_B_EMAIL),
          status: "pending",
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  describe("cross-group rejection (group-A head → group-B targets)", () => {
    it("execute on a group-B rule is FORBIDDEN", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.execute({
          ruleId: RULE_B,
          recipientEmail: LEAD_B_EMAIL,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("listExecutions on a group-B rule is FORBIDDEN", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.listExecutions({ ruleId: RULE_B }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("dispatchPending for a group-B lead is FORBIDDEN", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.dispatchPending({
          reportId: TEST_IDS.report,
          leadId: LEAD_B,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "lead-out-of-scope",
      });
    });

    it("dispatchPending on an out-of-scope active report is FORBIDDEN (no rule-existence oracle)", async () => {
      // activeReportId is the globally-newest draft, not group-bounded; a group-A
      // head whose active report is group-B's must fail closed BEFORE any rule is
      // resolved, so the response cannot reveal whether a rule exists there.
      const caller = buildCaller("head", REPORT_B);
      await expect(
        caller.reminders.dispatchPending({
          reportId: REPORT_B,
          ruleId: RULE_B,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("positive paths and the open-mailer hole", () => {
    it("executes for an in-scope draft author", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      const result = await caller.reminders.execute({
        ruleId: RULE_A,
        recipientEmail: LEAD_A_EMAIL,
      });
      expect(result.recipientEmail).toBe(LEAD_A_EMAIL);
      expect(result.ruleId).toBe(RULE_A);
    });

    it("rejects an arbitrary (non-author) recipient email", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.execute({
          ruleId: RULE_A,
          recipientEmail: "stranger@evil.local",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a real draft author who is out of the caller's group", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.execute({
          ruleId: RULE_A,
          recipientEmail: LEAD_B_EMAIL,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("listExecutions mixed-scope leak", () => {
    it("returns only the caller's group's recipient rows", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      const result = await caller.reminders.listExecutions({ ruleId: RULE_A });

      expect(result.items).toHaveLength(1);
      const [row] = result.items;
      expect(row.recipientEmail).toBe(LEAD_A_EMAIL);
      // No group-B recipientEmail / dedupeKey leaks through.
      expect(
        result.items.some(
          (e) =>
            e.recipientEmail === LEAD_B_EMAIL ||
            e.dedupeKey.includes(LEAD_B_EMAIL),
        ),
      ).toBe(false);
    });
  });

  describe("dispatchPending — in-scope lead with no draft section", () => {
    it("returns no-matching-section, not FORBIDDEN", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      const result = await caller.reminders.dispatchPending({
        reportId: TEST_IDS.report,
        leadId: LEAD_A2,
      });
      expect(result.reason).toBe("no-matching-section");
      expect(result.dispatched).toBe(0);
    });
  });

  describe("admin god-mode reaches every procedure unfiltered", () => {
    it("executes against a group it does not belong to", async () => {
      const caller = buildCaller("admin", REPORT_B);
      const result = await caller.reminders.execute({
        ruleId: RULE_B,
        recipientEmail: LEAD_B_EMAIL,
      });
      expect(result.recipientEmail).toBe(LEAD_B_EMAIL);
    });

    it("lists every recipient row regardless of group", async () => {
      const caller = buildCaller("admin", REPORT_B);
      const result = await caller.reminders.listExecutions({ ruleId: RULE_A });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((e) => e.recipientEmail).sort()).toEqual(
        [LEAD_A_EMAIL, LEAD_B_EMAIL].sort(),
      );
    });

    it("dispatches for a lead in a group it does not belong to", async () => {
      // The head path throws FORBIDDEN (`lead-out-of-scope`) for LEAD_B; admin
      // god-mode authorizes the out-of-group lead and the procedure resolves to
      // its dispatch summary instead of a scope rejection. dispatchPending's
      // gate now compares against the DB-resolved current editable report, so
      // this test makes REPORT_B that report (report A stays current for
      // every other test in this suite).
      await prisma.report.update({
        where: { id: REPORT_B },
        data: {
          periodStart: new Date("2026-05-05"),
          periodEnd: new Date("2026-05-11"),
        },
      });
      const caller = buildCaller("admin", REPORT_B);
      const result = await caller.reminders.dispatchPending({
        reportId: REPORT_B,
        leadId: LEAD_B,
      });
      expect(result.dispatched).toEqual(expect.any(Number));
    });
  });

  it("a thrown cross-group rejection is a TRPCError", async () => {
    const caller = buildCaller("head", TEST_IDS.report);
    await expect(
      caller.reminders.listExecutions({ ruleId: RULE_B }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
