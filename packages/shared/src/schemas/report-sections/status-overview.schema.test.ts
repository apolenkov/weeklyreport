import { describe, expect, it } from "vitest";

import { leadStatusOverviewOutputSchema } from "./status-overview.schema";

const CURRENT_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PREVIOUS_REPORT_ID = "22222222-2222-4222-8222-222222222222";
const CURRENT_SECTION_ID = "33333333-3333-4333-8333-333333333333";
const PREVIOUS_SECTION_ID = "44444444-4444-4444-8444-444444444444";
const AUTHOR_ID = "55555555-5555-4555-8555-555555555555";
const GROUP_ID = "66666666-6666-4666-8666-666666666666";

function section(reportId: string, reportSectionId: string) {
  return {
    reportSectionId,
    reportId,
    authorId: AUTHOR_ID,
    authorName: "Lead One",
    authorRole: "lead" as const,
    version: 1,
    status: "submitted" as const,
    submittedAt: new Date("2026-08-23T12:00:00.000Z"),
    late: false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

const current = {
  reportId: CURRENT_REPORT_ID,
  periodStart: new Date("2026-08-24T00:00:00.000Z"),
  periodEnd: new Date("2026-08-30T23:59:59.999Z"),
  section: section(CURRENT_REPORT_ID, CURRENT_SECTION_ID),
};

const predecessorPeriod = {
  reportId: PREVIOUS_REPORT_ID,
  periodStart: new Date("2026-08-17T00:00:00.000Z"),
  periodEnd: new Date("2026-08-23T23:59:59.999Z"),
};

describe("leadStatusOverviewOutputSchema", () => {
  it("accepts an immutable published predecessor", () => {
    const result = leadStatusOverviewOutputSchema.parse({
      current,
      predecessor: {
        ...predecessorPeriod,
        availability: "available",
        source: "published",
        section: {
          ...section(PREVIOUS_REPORT_ID, PREVIOUS_SECTION_ID),
          groupId: GROUP_ID,
          groupName: "Delivery",
        },
      },
    });

    expect(result.predecessor).toMatchObject({
      availability: "available",
      source: "published",
    });
  });

  it("accepts only a submitted live fallback", () => {
    expect(
      leadStatusOverviewOutputSchema.safeParse({
        current,
        predecessor: {
          ...predecessorPeriod,
          availability: "available",
          source: "submitted",
          section: section(PREVIOUS_REPORT_ID, PREVIOUS_SECTION_ID),
        },
      }).success,
    ).toBe(true);

    expect(
      leadStatusOverviewOutputSchema.safeParse({
        current,
        predecessor: {
          ...predecessorPeriod,
          availability: "available",
          source: "submitted",
          section: {
            ...section(PREVIOUS_REPORT_ID, PREVIOUS_SECTION_ID),
            status: "draft",
            submittedAt: null,
          },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    { availability: "unavailable", reason: "no_predecessor" },
    {
      ...predecessorPeriod,
      availability: "unavailable",
      reason: "section_unavailable",
    },
    {
      ...predecessorPeriod,
      availability: "unavailable",
      reason: "invalid_published_snapshot",
    },
  ])("accepts unavailable predecessor state %#", (predecessor) => {
    expect(
      leadStatusOverviewOutputSchema.safeParse({ current, predecessor })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed published predecessor shape", () => {
    const result = leadStatusOverviewOutputSchema.safeParse({
      current,
      predecessor: {
        ...predecessorPeriod,
        availability: "available",
        source: "published",
        // A published section must retain its immutable author-group identity.
        section: section(PREVIOUS_REPORT_ID, PREVIOUS_SECTION_ID),
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatched section/report identities", () => {
    const result = leadStatusOverviewOutputSchema.safeParse({
      current,
      predecessor: {
        ...predecessorPeriod,
        availability: "available",
        source: "submitted",
        section: section(CURRENT_REPORT_ID, PREVIOUS_SECTION_ID),
      },
    });

    expect(result.success).toBe(false);
  });
});
