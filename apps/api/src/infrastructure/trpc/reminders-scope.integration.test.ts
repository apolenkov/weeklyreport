import { TRPCError } from "@trpc/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import type { OrganizationService } from "../../modules/organization/index.js";
import { RemindersPrismaRepository } from "../../modules/reminders/index.js";
import { RemindersService } from "../../modules/reminders/index.js";
import { WeeklyReportPrismaRepository } from "../../modules/weekly-report/index.js";
import { WeeklyReportService } from "../../modules/weekly-report/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "./trpc.router.js";

// Per-group authorization for the three reminder procedures (real DB): a
// group-A head must not execute/list/dispatch reminders against another group
// nor send to an arbitrary email; admin keeps god-mode. Router → service → Prisma.
const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const LEAD_A2 = "a0000000-0000-4000-a000-0000000000a2";
const SECTION_B_ON_A = "b0000000-0000-4000-8000-0000000000b3";
const REPORT_B = TEST_IDS.targetReport;
const SECTION_B_ON_B = "b0000000-0000-4000-8000-0000000000b4";
const RULE_A = TEST_IDS.reminderRule;
const RULE_B = "b0000000-0000-4000-8000-0000000000b5";
const POLICY_ID = "b0000000-0000-4000-8000-0000000000b6";
const FIRE_AT = new Date("2026-04-11T09:00:00.000Z");

const LEAD_A_EMAIL = "lead1@test.local"; // seedTestData lead, group A
const LEAD_B_EMAIL = "lead-b@test.local";
const HEAD_A_EMAIL = "head@test.local";
const QUEUE_PAYLOAD = {
  kind: "deadline" as const,
  cycleDate: "2026-04-11",
  leadName: "Test Lead",
  reportPeriod: "2026-04-06 → 2026-04-12",
  deadlineIso: "2026-04-11T09:00:00.000Z",
  sectionUrl: "https://example.test/lead/report",
  organization: {
    shortName: "CustomReport",
    fullName: "CustomReport Department",
  },
};

const ORGANIZATION_SERVICE = {
  getPublic: () =>
    Promise.resolve({
      shortName: "CustomReport",
      fullName: "CustomReport Department",
    }),
} as OrganizationService;

const TEST_ENV = {
  APP_BASE_URL: "http://localhost:3000",
};

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
  const remindersService = new RemindersService(
    repo,
    undefined,
    undefined,
    undefined,
    ORGANIZATION_SERVICE,
    TEST_ENV,
  );
  const weeklyReportService = new WeeklyReportService(
    new WeeklyReportPrismaRepository(prisma as never),
  );
  const deps = createStubAppRouterDeps({
    prisma,
    env: TEST_ENV,
    organizationService: ORGANIZATION_SERVICE,
    remindersService,
    weeklyReportService,
  });
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
    await cleanDatabase();
    const data = await seedTestData(prisma);
    await prisma.report.update({
      where: { id: data.report.id },
      data: { deadline: FIRE_AT },
    });

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
        // BEFORE the shared report A's period (2026-04-07) so report A stays
        // the DB-resolved current editable period across this suite —
        // dispatchPending's gate compares against that resolved value.
        periodStart: new Date("2026-03-24"),
        periodEnd: new Date("2026-03-30"),
        deadline: FIRE_AT,
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

    await prisma.reminderPolicy.create({
      data: {
        id: POLICY_ID,
        kind: "deadline",
        offsetMinutes: 0,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        // Keep the historical fixture deadline inside the policy's validity
        // window; Prisma defaults validFrom to the wall clock at insert time.
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    // Active rules: A on the shared report, B on the group-B report.
    await prisma.reminderRule.createMany({
      data: [
        {
          id: RULE_A,
          policyId: POLICY_ID,
          kind: "deadline",
          fireAt: FIRE_AT,
          deadline: FIRE_AT,
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          reportId: data.report.id,
        },
        {
          id: RULE_B,
          policyId: POLICY_ID,
          kind: "deadline",
          fireAt: FIRE_AT,
          deadline: FIRE_AT,
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
          recipientEmail: LEAD_A_EMAIL,
          dedupeKey: dedupeKey(RULE_A, LEAD_A_EMAIL),
          status: "pending",
          queuePayload: QUEUE_PAYLOAD,
        },
        {
          id: TEST_IDS.reminderExec2,
          ruleId: RULE_A,
          recipientEmail: LEAD_B_EMAIL,
          dedupeKey: dedupeKey(RULE_A, LEAD_B_EMAIL),
          status: "pending",
          queuePayload: QUEUE_PAYLOAD,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  describe("cross-group rejection (group-A head → group-B targets)", () => {
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
          ruleId: RULE_A,
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

  describe("listExecutions mixed-scope leak", () => {
    it("returns only the caller's group's recipient rows", async () => {
      const caller = buildCaller("head", TEST_IDS.report);
      const result = await caller.reminders.listExecutions({ ruleId: RULE_A });

      expect(result.items).toHaveLength(1);
      const [row] = result.items;
      expect(row?.recipientEmail).toBe(LEAD_A_EMAIL);
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
        ruleId: RULE_A,
        leadId: LEAD_A2,
      });
      expect(result.reason).toBe("no-matching-section");
      expect(result.queued).toBe(0);
    });

    // Distinct from the no-section case above: the lead HAS a section on the
    // report, but it is not draft (submitted), so the draft-section filter
    // still yields zero matches and the soft no-matching-section exit fires.
    it("returns no-matching-section when the lead's section is submitted", async () => {
      await prisma.reportSection.updateMany({
        where: { reportId: TEST_IDS.report, authorId: TEST_IDS.lead },
        data: { status: "submitted" },
      });

      const caller = buildCaller("head", TEST_IDS.report);
      const result = await caller.reminders.dispatchPending({
        reportId: TEST_IDS.report,
        ruleId: RULE_A,
        leadId: TEST_IDS.lead,
      });
      expect(result.reason).toBe("no-matching-section");
      expect(result.queued).toBe(0);
    });

    it("rejects a deactivated lead before manual recipient discovery", async () => {
      await prisma.user.update({
        where: { id: TEST_IDS.lead },
        data: { isActive: false },
      });

      const caller = buildCaller("head", TEST_IDS.report);
      await expect(
        caller.reminders.dispatchPending({
          reportId: TEST_IDS.report,
          ruleId: RULE_A,
          leadId: TEST_IDS.lead,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "lead-out-of-scope",
      });
    });
  });

  describe("admin god-mode reaches every procedure unfiltered", () => {
    it("lists every recipient row regardless of group", async () => {
      const caller = buildCaller("admin", REPORT_B);
      const result = await caller.reminders.listExecutions({ ruleId: RULE_A });
      expect(result.items).toHaveLength(2);
      expect(result.items.map((e) => e.recipientEmail).sort()).toEqual(
        [LEAD_A_EMAIL, LEAD_B_EMAIL].sort(),
      );
    });

    it("dispatches for a lead in a group it does not belong to", async () => {
      // The head path throws FORBIDDEN for LEAD_B; admin god-mode authorizes
      // the out-of-group lead. dispatchPending's gate resolves the current
      // editable report from the DB, so this test makes REPORT_B that report.
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
        ruleId: RULE_B,
        leadId: LEAD_B,
      });
      expect(result.queued).toBe(1);
    });
  });

  it("a thrown cross-group rejection is a TRPCError", async () => {
    const caller = buildCaller("head", TEST_IDS.report);
    await expect(
      caller.reminders.listExecutions({ ruleId: RULE_B }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
