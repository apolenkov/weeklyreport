import { requirePublishedSnapshot } from "@customreport/report-persistence";
import {
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionReadModel } from "../../../test-utils/report-section-fixtures.js";
import {
  canReadPublishedSnapshot,
  filterPublishedSnapshotForSession,
} from "./published-report-scope.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_A = "22222222-2222-4222-8222-222222222222";
const GROUP_B = "33333333-3333-4333-8333-333333333333";
const LEAD_A = "44444444-4444-4444-8444-444444444444";
const LEAD_B = "55555555-5555-4555-8555-555555555555";
const SECTION_A = "66666666-6666-4666-8666-666666666666";
const SECTION_B = "77777777-7777-4777-8777-777777777777";

function snapshot() {
  return publishedReportSnapshotSchema.parse({
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-17T00:00:00.000Z"),
    periodEnd: new Date("2026-08-23T23:59:59.999Z"),
    deadline: null,
    status: "published",
    publishedAt: new Date("2026-08-23T18:00:00.000Z"),
    publishedById: null,
    publishedByName: "system",
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [
      {
        ...makeReportSectionReadModel({
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: LEAD_A,
          authorName: "Lead A",
        }),
        groupId: GROUP_A,
        groupName: "Group A at publication",
      },
      {
        ...makeReportSectionReadModel({
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: LEAD_B,
          authorName: "Lead B",
        }),
        groupId: GROUP_B,
        groupName: "Group B at publication",
      },
    ],
  });
}

function session(
  role: UserSession["role"],
  overrides: Partial<UserSession> = {},
): UserSession {
  return {
    userId: "88888888-8888-4888-8888-888888888888",
    email: "snapshot-scope@example.test",
    name: "Snapshot Scope",
    role,
    ...overrides,
  };
}

describe("published snapshot frozen section scope", () => {
  it("fails closed when a section has no immutable author-group ownership", () => {
    const malformed = structuredClone(snapshot()) as unknown as {
      sections: Record<string, unknown>[];
    };
    delete malformed.sections[0]?.groupId;

    expect(() =>
      requirePublishedSnapshot(malformed as never, REPORT_ID),
    ).toThrow(/Published snapshot integrity failure/);
  });

  it("scopes viewer and head reads by current grants against frozen group ids", () => {
    const viewerResult = filterPublishedSnapshotForSession(
      snapshot(),
      session("viewer", { viewerGroupAccess: [GROUP_A] }),
    );
    const headResult = filterPublishedSnapshotForSession(
      snapshot(),
      session("head", { reportingGroupId: GROUP_B }),
    );

    expect(
      viewerResult.sections.map((section) => section.reportSectionId),
    ).toEqual([SECTION_A]);
    expect(
      headResult.sections.map((section) => section.reportSectionId),
    ).toEqual([SECTION_B]);
    expect(viewerResult.sections[0]?.groupName).toBe("Group A at publication");
  });

  it("preserves lead-own history scope without consulting a live author row", () => {
    const lead = session("lead", {
      userId: LEAD_A,
      reportingGroupId: GROUP_A,
    });
    const scoped = filterPublishedSnapshotForSession(
      snapshot(),
      lead,
      "lead-own",
    );

    expect(scoped.sections.map((section) => section.reportSectionId)).toEqual([
      SECTION_A,
    ]);
    expect(canReadPublishedSnapshot(snapshot(), lead, "lead-own")).toBe(true);
  });

  it("denies an empty current grant set even when the snapshot has sections", () => {
    const viewer = session("viewer", { viewerGroupAccess: [] });

    expect(canReadPublishedSnapshot(snapshot(), viewer)).toBe(false);
    expect(
      filterPublishedSnapshotForSession(snapshot(), viewer).sections,
    ).toEqual([]);
  });
});
