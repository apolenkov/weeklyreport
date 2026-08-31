import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { editableReminderReportWhere } from "./reminders-editable-report.prisma.js";
import {
  queryActiveRuleForDispatch,
  queryDraftSectionsForDispatch,
  queryInScopeLeadId,
  queryInScopeSectionAuthorEmails,
} from "./reminders-scope.prisma-query.js";

// These mocks pin the complete editable lifecycle passed to Prisma so manual
// dispatch cannot drift from scheduler and atomic-insert eligibility.
const REPORT_ID = "b0000000-0000-4000-a000-0000000000b1";
const RULE_ID = "b0000000-0000-4000-a000-0000000000b2";
const LEAD_ID = "b0000000-0000-4000-a000-0000000000b3";

const headSession: UserSession = {
  userId: "b0000000-0000-4000-a000-0000000000b5",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: REPORT_ID,
  activeReportSectionId: null,
};

const asNever = (value: unknown): never => value as never;

describe("manual dispatch queries require an editable report", () => {
  it("requires the caller's exact active deadline rule and policy", async () => {
    const deadline = new Date("2026-04-13T18:00:00.000Z");
    const prisma = {
      reminderRule: {
        findFirst: vi.fn().mockResolvedValue({
          id: RULE_ID,
          kind: "deadline",
          fireAt: new Date("2026-04-12T18:00:00.000Z"),
          deadline,
          timezone: "Europe/Moscow",
          report: { deadline },
          policy: {
            kind: "deadline",
            offsetMinutes: -1440,
            timezone: "Europe/Moscow",
            active: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: null,
          },
        }),
      },
    };

    await expect(
      queryActiveRuleForDispatch(asNever(prisma), REPORT_ID, RULE_ID),
    ).resolves.toEqual({
      id: RULE_ID,
      fireAt: new Date("2026-04-12T18:00:00.000Z"),
      deadline,
    });

    expect(prisma.reminderRule.findFirst.mock.calls).toMatchObject([
      [
        {
          where: {
            reportId: REPORT_ID,
            id: RULE_ID,
            kind: "deadline",
            status: "active",
            policy: { active: true },
            report: editableReminderReportWhere,
          },
        },
      ],
    ]);
  });

  it("fails closed when the selected rule no longer matches the policy schedule", async () => {
    const deadline = new Date("2026-04-13T18:00:00.000Z");
    const prisma = {
      reminderRule: {
        findFirst: vi.fn().mockResolvedValue({
          id: RULE_ID,
          kind: "deadline",
          fireAt: new Date("2026-04-11T18:00:00.000Z"),
          deadline,
          timezone: "Europe/Moscow",
          report: { deadline },
          policy: {
            kind: "deadline",
            offsetMinutes: -1440,
            timezone: "Europe/Moscow",
            active: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: null,
          },
        }),
      },
    };

    await expect(
      queryActiveRuleForDispatch(asNever(prisma), REPORT_ID, RULE_ID),
    ).resolves.toBeNull();
  });

  it("queryDraftSectionsForDispatch uses the exact lifecycle predicate", async () => {
    const prisma = {
      reportSection: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await queryDraftSectionsForDispatch(
      asNever(prisma),
      headSession,
      REPORT_ID,
      LEAD_ID,
    );

    expect(prisma.reportSection.findMany.mock.calls).toMatchObject([
      [
        {
          where: {
            reportId: REPORT_ID,
            status: "draft",
            report: editableReminderReportWhere,
            authorId: LEAD_ID,
            AND: [expect.any(Object), { author: { isActive: true } }],
          },
        },
      ],
    ]);
  });

  it("queryDraftSectionsForDispatch excludes inactive authors", async () => {
    const findMany = vi
      .fn<(args: unknown) => Promise<never[]>>()
      .mockResolvedValue([]);
    const prisma = {
      reportSection: { findMany },
    };

    await queryDraftSectionsForDispatch(
      asNever(prisma),
      headSession,
      REPORT_ID,
    );

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        AND: [{ id: { in: [] } }, { author: { isActive: true } }],
      },
    });
  });

  it("queryInScopeLeadId refuses an inactive manual target", async () => {
    const findFirst = vi
      .fn<(args: unknown) => Promise<null>>()
      .mockResolvedValue(null);
    const prisma = {
      user: { findFirst },
    };

    await queryInScopeLeadId(asNever(prisma), headSession, LEAD_ID);

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: LEAD_ID,
        isActive: true,
        AND: [{ id: { in: [] } }],
      },
    });
  });

  it("queryInScopeSectionAuthorEmails excludes inactive authors", async () => {
    const findMany = vi
      .fn<(args: unknown) => Promise<never[]>>()
      .mockResolvedValue([]);
    const prisma = {
      reportSection: { findMany },
    };

    await queryInScopeSectionAuthorEmails(
      asNever(prisma),
      headSession,
      REPORT_ID,
    );

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        AND: [{ id: { in: [] } }, { author: { isActive: true } }],
      },
    });
  });
});
