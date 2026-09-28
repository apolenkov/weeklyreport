import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import { ACTIVE_REPORT_ID } from "../support/seed-constants.js";
import {
  assertActiveReminderRuleIntegrity,
  assertPendingReopenRequestIntegrity,
} from "./seed-profile-journeys.js";
import {
  assertProjectGroupIntegrity,
  assertPublishedSnapshotIntegrity,
  validateSeedProfile,
} from "./seed-profile-validator.js";

const LEAD = "a0000000-0000-4000-8000-000000000001";
const GROUP = "a0000000-0000-4000-8000-000000000002";
const OTHER_GROUP = "a0000000-0000-4000-8000-000000000003";
const PRODUCT = "a0000000-0000-4000-8000-000000000004";
const REPORT = "a0000000-0000-4000-8000-000000000005";
const SECTION = "a0000000-0000-4000-8000-000000000006";

const snapshot = provisionalPublishedSnapshot({
  reportId: REPORT,
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.999Z"),
  deadline: new Date("2026-04-10T15:00:00.000Z"),
  publishedAt: new Date("2026-04-12T23:59:59.999Z"),
  publishedById: LEAD,
  publishedByName: "Seed Publisher",
});

describe("seed profile product-group integrity", () => {
  it("accepts the product edge that matches its lead's effective group", () => {
    expect(() =>
      assertProjectGroupIntegrity(
        "full",
        [{ id: LEAD, reportingGroupId: GROUP }],
        [{ id: PRODUCT, leadId: LEAD, groupProducts: [{ groupId: GROUP }] }],
      ),
    ).not.toThrow();
  });

  it("rejects a product edge assigned to another group", () => {
    expect(() =>
      assertProjectGroupIntegrity(
        "full",
        [{ id: LEAD, reportingGroupId: GROUP }],
        [
          {
            id: PRODUCT,
            leadId: LEAD,
            groupProducts: [{ groupId: OTHER_GROUP }],
          },
        ],
      ),
    ).toThrow(/product-group integrity failed/);
  });
});

describe("seed profile published-snapshot integrity", () => {
  it("accepts a valid snapshot matching the published row", () => {
    expect(() =>
      assertPublishedSnapshotIntegrity("full", [
        {
          id: REPORT,
          status: "published",
          publishedSnapshot: snapshot as never,
          sections: [],
        },
      ]),
    ).not.toThrow();
  });

  it("rejects a published row whose live sections were not finalized", () => {
    expect(() =>
      assertPublishedSnapshotIntegrity("full", [
        {
          id: REPORT,
          status: "published",
          publishedSnapshot: snapshot as never,
          sections: [{ id: SECTION }],
        },
      ]),
    ).toThrow(/snapshot sections do not match live seeded sections/);
  });

  it("rejects a missing published snapshot", () => {
    expect(() =>
      assertPublishedSnapshotIntegrity("full", [
        {
          id: REPORT,
          status: "published",
          publishedSnapshot: null,
          sections: [],
        },
      ]),
    ).toThrow(/snapshot is absent or malformed/);
  });
});

describe("seed profile reminder integrity", () => {
  const reportDeadline = new Date("2026-09-04T12:00:00.000Z");
  const baseRule = {
    id: "a0000000-0000-4000-8000-000000000801",
    kind: "deadline" as const,
    deadline: reportDeadline,
    timezone: "Europe/Moscow",
    report: { deadline: reportDeadline },
    policy: {
      kind: "deadline" as const,
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      active: true,
      validFrom: new Date("2026-08-31T00:00:00.000Z"),
      validUntil: null,
    },
  };

  it("accepts a rule derived from its report and policy", () => {
    expect(() =>
      assertActiveReminderRuleIntegrity([
        {
          ...baseRule,
          fireAt: new Date("2026-09-03T12:00:00.000Z"),
        },
      ]),
    ).not.toThrow();
  });

  it("rejects a stale rule scheduled at the report deadline", () => {
    expect(() =>
      assertActiveReminderRuleIntegrity([
        { ...baseRule, fireAt: reportDeadline },
      ]),
    ).toThrow(/schedule does not match report and policy/);
  });
});

describe("seed profile reopen-request integrity", () => {
  const actionableRequest = {
    id: "a0000000-0000-4000-8000-000000000d01",
    reportSection: {
      status: "submitted" as const,
      report: {
        id: ACTIVE_REPORT_ID,
        archived: false,
        periodState: "open" as const,
        periodStatus: "open" as const,
      },
    },
  };

  it("accepts one pending request on a current submitted section", () => {
    expect(() =>
      assertPendingReopenRequestIntegrity([actionableRequest]),
    ).not.toThrow();
  });

  it("rejects a pending request on another scoped open report", () => {
    // a0000000-...-0004 is inside the demo report scope but is not the current report.
    const foreignReportRequest = {
      ...actionableRequest,
      reportSection: {
        ...actionableRequest.reportSection,
        report: {
          ...actionableRequest.reportSection.report,
          id: "a0000000-0000-4000-8000-000000000004",
        },
      },
    };
    expect(() =>
      assertPendingReopenRequestIntegrity([foreignReportRequest]),
    ).toThrow(/not actionable/);
  });

  it("rejects a published-period request that cannot be decided", () => {
    expect(() =>
      assertPendingReopenRequestIntegrity([
        {
          ...actionableRequest,
          reportSection: {
            ...actionableRequest.reportSection,
            report: {
              ...actionableRequest.reportSection.report,
              periodState: "published",
              periodStatus: "published",
            },
          },
        },
      ]),
    ).toThrow(/not actionable/);
  });
});

describe("seed profile snapshot content proof", () => {
  const sectionId = "a0000000-0000-4000-8000-000000000401";
  const baseItem = {
    reportSectionId: sectionId,
    id: "a0000000-0000-4000-8000-000000000501",
    stableId: "a0000000-0000-4000-8000-000000000551",
    text: "Initial item text",
  };
  const baseRisk = {
    reportSectionId: sectionId,
    id: "a0000000-0000-4000-8000-000000000601",
    stableId: "a0000000-0000-4000-8000-000000000651",
    risk: "Initial risk",
    impact: "Initial impact",
    mitigation: "Initial mitigation",
  };

  // The fake honors the writer's `select` like a real query: fields the
  // snapshot query does not request never reach the returned snapshot.
  function applySelect(
    rows: readonly Record<string, unknown>[],
    select: Record<string, unknown>,
  ): Record<string, unknown>[] {
    const keys = Object.keys(select).filter((key) => select[key] === true);
    return rows.map((row) =>
      Object.fromEntries(keys.map((key) => [key, row[key]])),
    );
  }

  // Fake read seam: counts satisfy the minimal manifest bounds; the journey
  // finds its single draft section on the active report.
  function profilePrisma(dataset: {
    items: readonly (typeof baseItem)[];
    risks: readonly (typeof baseRisk)[];
  }): PrismaClient {
    return {
      user: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn().mockResolvedValue([]),
      },
      project: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
      },
      report: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({
          periodState: "open",
          sections: [
            {
              status: "draft",
              items: [{ id: "a0000000-0000-4000-8000-000000000501" }],
            },
          ],
        }),
      },
      reportSection: { count: vi.fn().mockResolvedValue(1) },
      item: {
        count: vi.fn().mockResolvedValue(dataset.items.length),
        findMany: vi
          .fn()
          .mockImplementation((args: { select: Record<string, unknown> }) =>
            Promise.resolve(applySelect(dataset.items, args.select)),
          ),
      },
      risk: {
        findMany: vi
          .fn()
          .mockImplementation((args: { select: Record<string, unknown> }) =>
            Promise.resolve(applySelect(dataset.risks, args.select)),
          ),
      },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
  }

  it("returns equal snapshots for identical reads", async () => {
    const dataset = { items: [baseItem], risks: [baseRisk] };
    const first = await validateSeedProfile(profilePrisma(dataset), "minimal");
    const second = await validateSeedProfile(profilePrisma(dataset), "minimal");
    expect(second).toEqual(first);
  });

  it("detects item and risk text changes with identical identities", async () => {
    const first = await validateSeedProfile(
      profilePrisma({ items: [baseItem], risks: [baseRisk] }),
      "minimal",
    );
    const second = await validateSeedProfile(
      profilePrisma({
        items: [{ ...baseItem, text: "Rewritten item text" }],
        risks: [{ ...baseRisk, impact: "Rewritten impact" }],
      }),
      "minimal",
    );

    expect(second).not.toEqual(first);
    expect((second.itemRecords[0] as { text?: string }).text).toBe(
      "Rewritten item text",
    );
    expect((second.riskRecords[0] as { impact?: string }).impact).toBe(
      "Rewritten impact",
    );
    expect(second.riskRecords[0]?.risk).toBe(baseRisk.risk);
    expect(second.riskRecords[0]?.mitigation).toBe(baseRisk.mitigation);
  });
});
