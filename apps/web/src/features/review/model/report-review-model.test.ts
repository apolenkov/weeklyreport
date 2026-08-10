import type { PeriodStatus, Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";
import {
  buildReviewModel,
  distinctReviewGroups,
  isReviewEnabled,
} from "./report-review-model";

const GROUP_A = "11111111-1111-4111-8111-111111111111";
const GROUP_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

describe("isReviewEnabled", () => {
  it.each([
    [null, "open", false],
    ["lead", "open", false],
    ["viewer", "open", true],
    ["head", "published", false],
    ["admin", "reopened", true],
  ] as const)(
    "gates role=%s periodStatus=%s",
    (role: Role | null, periodStatus: PeriodStatus, expected: boolean) => {
      expect(isReviewEnabled(role, periodStatus)).toBe(expected);
    },
  );
});

describe("distinctReviewGroups", () => {
  it("drops missing ids and keeps the first occurrence order", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [
        { groupId: GROUP_A },
        { groupId: null },
        { groupId: GROUP_B },
        { groupId: GROUP_A },
      ],
    });

    expect(distinctReviewGroups(report.leadSections)).toEqual([
      { groupId: GROUP_A },
      { groupId: GROUP_B },
    ]);
  });
});

describe("buildReviewModel", () => {
  it("returns an empty model when the live review surface is disabled", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [{ groupId: GROUP_A }],
    });
    const onMutated = vi.fn();

    expect(
      buildReviewModel(report, {
        currentRole: "lead",
        periodStatus: "open",
        currentUserId: USER_ID,
        onMutated,
      }),
    ).toEqual({
      context: undefined,
      groups: [],
      sections: [],
      isHeadOrAdmin: false,
    });
  });

  it("maps reviewer context, deduplicated groups, and section rows", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [
        {
          groupId: GROUP_A,
          status: "submitted",
          canReview: true,
        },
        {
          groupId: GROUP_A,
          status: "draft",
          canReview: false,
        },
        {
          groupId: GROUP_B,
          status: "submitted",
          canReview: true,
        },
      ],
    });
    const onMutated = vi.fn();
    const model = buildReviewModel(report, {
      currentRole: "admin",
      periodStatus: "open",
      currentUserId: USER_ID,
      onMutated,
    });

    expect(model.context).toEqual({
      currentUserId: USER_ID,
      isAdmin: true,
      onMutated,
    });
    expect(model.groups).toEqual([{ groupId: GROUP_A }, { groupId: GROUP_B }]);
    expect(
      model.sections.map((section) => ({
        reportSectionId: section.reportSectionId,
        status: section.status,
        canReview: section.canReview,
        groupId: section.groupId,
      })),
    ).toEqual([
      {
        reportSectionId: "10000000-0000-4000-8000-000000000002",
        status: "submitted",
        canReview: true,
        groupId: GROUP_A,
      },
      {
        reportSectionId: "10000000-0000-4000-8000-000000000002",
        status: "draft",
        canReview: false,
        groupId: GROUP_A,
      },
      {
        reportSectionId: "10000000-0000-4000-8000-000000000002",
        status: "submitted",
        canReview: true,
        groupId: GROUP_B,
      },
    ]);
    expect(model.isHeadOrAdmin).toBe(true);
  });
});
