import { describe, expect, it } from "vitest";

import {
  parsePublishedSnapshot,
  publishedSnapshotFailure,
  PublishedSnapshotIntegrityError,
  requirePublishedSnapshot,
} from "./published-snapshot.js";

const reportId = "00000001-0000-4000-8000-000000000000";

// An accessor exercises the parser's genuine exceptional input boundary;
// ordinary persisted JSON cannot itself throw while a property is read.
const throwingSnapshot = (error: unknown) => ({
  get reportId(): string {
    throw error;
  },
});

describe("published snapshot public failure contracts", () => {
  it.each([
    [undefined, "Published snapshot integrity failure: missing"],
    [
      reportId,
      `Published snapshot integrity failure for report ${reportId}: missing`,
    ],
  ])("formats an explicit failure for report %s", (id, message) => {
    const error = publishedSnapshotFailure(id, "missing");
    expect(error).toBeInstanceOf(PublishedSnapshotIntegrityError);
    expect(error.name).toBe("PublishedSnapshotIntegrityError");
    expect(error.message).toBe(message);
  });

  it.each([
    [
      new Error("broken"),
      undefined,
      "Published snapshot integrity failure: broken",
    ],
    [
      new Error("broken"),
      reportId,
      `Published snapshot integrity failure for report ${reportId}: broken`,
    ],
    [new Error(""), undefined, "Published snapshot integrity failure: "],
    [
      new Error(""),
      reportId,
      `Published snapshot integrity failure for report ${reportId}: `,
    ],
    ["non-Error", undefined, "Published snapshot integrity failure"],
    [
      "non-Error",
      reportId,
      `Published snapshot integrity failure for report ${reportId}`,
    ],
  ])(
    "preserves the message of throwable %j for report %s",
    (error, id, message) => {
      expect(() =>
        requirePublishedSnapshot(throwingSnapshot(error), id),
      ).toThrow(new PublishedSnapshotIntegrityError(message));
    },
  );

  it.each([null, undefined])(
    "keeps nullable parsing separate from mandatory consumption: %s",
    (value) => {
      expect(parsePublishedSnapshot(value)).toBeNull();
      expect(() => requirePublishedSnapshot(value, reportId)).toThrow(
        new PublishedSnapshotIntegrityError(
          `Published snapshot integrity failure for report ${reportId}: snapshot is absent.`,
        ),
      );
    },
  );

  it("passes an existing integrity error through by object identity", () => {
    const original = publishedSnapshotFailure(reportId, "already diagnosed");
    try {
      requirePublishedSnapshot(throwingSnapshot(original), reportId);
      expect.unreachable("Mandatory consumption must fail");
    } catch (error) {
      expect(error).toBe(original);
    }
  });
});

const stageId = "00000002-0000-4000-8000-000000000000";
const testStageId = "00000003-0000-4000-8000-000000000000";
const projectId = "00000004-0000-4000-8000-000000000000";
const groupId = "00000005-0000-4000-8000-000000000000";

function sharedStageSnapshot(conflictingOwners: boolean) {
  const stageSet = [
    { stageId, stageName: "Build", sortOrder: 0 },
    { stageId: testStageId, stageName: "Test", sortOrder: 1 },
  ] as const;
  return {
    reportId,
    periodStart: "2026-10-05T00:00:00.000Z",
    periodEnd: "2026-10-11T00:00:00.000Z",
    deadline: null,
    status: "published",
    publishedAt: "2026-10-12T10:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [0, 1].map((index) => ({
      reportSectionId: `0000001${index}-0000-4000-8000-000000000000`,
      reportId,
      authorId: `0000002${index}-0000-4000-8000-000000000000`,
      authorName: index === 0 ? "Build Lead" : "Test Lead",
      authorRole: "lead",
      version: 1,
      status: "submitted",
      submittedAt: null,
      late: false,
      groupId,
      groupName: "Synthetic group",
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
      projects: [
        {
          projectId,
          projectName: "Shared product",
          trafficLight: "green",
          ownerGroupId: groupId,
          stageSet,
          ownedStages: [
            {
              ...stageSet[index === 0 || conflictingOwners ? 0 : 1],
              status: null,
            },
          ],
        },
      ],
    })),
  };
}

describe("published stage ownership integrity", () => {
  it.each([false, true])(
    "rejects conflicting owned stages regardless of section order: reversed=%s",
    (reverse) => {
      const candidate = sharedStageSnapshot(true);
      if (reverse) candidate.sections.reverse();
      expect(parsePublishedSnapshot(candidate)).not.toBeNull();
      expect(() => requirePublishedSnapshot(candidate, reportId)).toThrow(
        new PublishedSnapshotIntegrityError(
          `Published snapshot integrity failure for report ${reportId}: project ${projectId} stage Build has conflicting authors.`,
        ),
      );
    },
  );

  it("accepts disjoint owned stages with the full shared stageSet on every author", () => {
    const admitted = requirePublishedSnapshot(
      sharedStageSnapshot(false),
      reportId,
    );
    expect(
      admitted.sections.map((section) =>
        section.projects[0]?.ownedStages.map((stage) => stage.stageName),
      ),
    ).toEqual([["Build"], ["Test"]]);
    for (const section of admitted.sections) {
      expect(
        section.projects[0]?.stageSet.map((stage) => stage.stageName),
      ).toEqual(["Build", "Test"]);
    }
  });

  it("allows the same owned stage name on different products", () => {
    const candidate = sharedStageSnapshot(true);
    candidate.sections = candidate.sections.map((section, index) => ({
      ...section,
      projects: section.projects.map((project) => ({
        ...project,
        projectId:
          index === 0
            ? project.projectId
            : "00000006-0000-4000-8000-000000000000",
      })),
    }));
    expect(requirePublishedSnapshot(candidate, reportId).sections).toHaveLength(
      2,
    );
  });
});
