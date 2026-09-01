import { describe, expect, it } from "vitest";

import { provisionalPublishedSnapshot } from "../support/published-snapshot.js";
import {
  assertActiveReminderRuleIntegrity,
  assertPendingReopenRequestIntegrity,
} from "./seed-profile-journeys.js";
import {
  assertProjectGroupIntegrity,
  assertPublishedSnapshotIntegrity,
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
