import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  queryActiveRuleForDispatch,
  queryDraftSectionsForDispatch,
} from "./reminders-scope.prisma-query.js";

// A period archived after its reminder rules materialized keeps those rules
// `active` — the dispatch queries are the enforcement point, so every manual
// dispatch predicate must exclude archived reports. These mocks pin the
// `where` shape passed to Prisma so a regression cannot pass vacuously.
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

describe("manual dispatch queries exclude archived periods", () => {
  it("queryActiveRuleForDispatch filters report.archived=false", async () => {
    const prisma = {
      reminderRule: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: RULE_ID, fireAt: new Date() }),
      },
    };

    await queryActiveRuleForDispatch(asNever(prisma), REPORT_ID);

    expect(prisma.reminderRule.findFirst.mock.calls).toMatchObject([
      [{ where: { report: { archived: false } } }],
    ]);
  });

  it("queryActiveRuleForDispatch keeps the caller-supplied ruleId when present", async () => {
    const prisma = {
      reminderRule: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: RULE_ID, fireAt: new Date() }),
      },
    };

    await queryActiveRuleForDispatch(asNever(prisma), REPORT_ID, RULE_ID);

    expect(prisma.reminderRule.findFirst.mock.calls).toMatchObject([
      [{ where: { id: RULE_ID, report: { archived: false } } }],
    ]);
  });

  it("queryDraftSectionsForDispatch filters report.archived=false", async () => {
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
      [{ where: { report: { archived: false }, authorId: LEAD_ID } }],
    ]);
  });
});
