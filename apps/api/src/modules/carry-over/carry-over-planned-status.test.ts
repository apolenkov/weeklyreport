import { randomUUID } from "node:crypto";

import {
  draftSaveSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined";
import { cloneCarriedItem } from "./carry-over-clones";
import { planCarriedEntries } from "./carry-over-plan";

function section(input: {
  readonly reportId: string;
  readonly items: ReportSectionReadModel["items"];
}): ReportSectionReadModel {
  const projectId = randomUUID();
  return {
    reportSectionId: randomUUID(),
    reportId: input.reportId,
    authorId: randomUUID(),
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId,
        projectName: "Product",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [],
    items: input.items.map((item) => ({
      ...item,
      projectId: projectId,
      activityId: undefined,
      stageNames: ["Development"],
    })),
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

describe("carry-over preserves planning intent", () => {
  it("consumes the next step without rewriting this week's result", () => {
    const source = {
      id: randomUUID(),
      stableId: randomUUID(),
      projectId: randomUUID(),
      type: "current" as const,
      workflowStatus: "in_progress" as const,
      text: "API implemented",
      nextStepText: "Run integration tests",
      tag: "feature",
      stageNames: ["Development"],
      carriedOver: true,
    };
    const { item } = cloneCarriedItem(
      randomUUID(),
      randomUUID(),
      source,
      new Date("2026-09-07T00:00:00Z"),
    );
    expect(item).toMatchObject({
      stableId: source.stableId,
      text: "Run integration tests",
      nextStepText: null,
      workflowStatus: "planned",
    });
    expect(source.text).toBe("API implemented");
    expect(source.nextStepText).toBe("Run integration tests");
  });

  it("keeps a legacy next-period plan's text unchanged", () => {
    const source = {
      id: randomUUID(),
      stableId: randomUUID(),
      projectId: randomUUID(),
      type: "next" as const,
      workflowStatus: "planned" as const,
      text: "Implement authorization",
      // Invalid for new writes, but old imported data can still contain it.
      nextStepText: "This must not replace the legacy plan",
      tag: "feature",
      stageNames: ["Development"],
      carriedOver: false,
    };

    const { item } = cloneCarriedItem(
      randomUUID(),
      randomUUID(),
      source,
      new Date("2026-09-07T00:00:00.000Z"),
    );

    expect(item).toMatchObject({
      text: "Implement authorization",
      nextStepText: null,
      workflowStatus: "planned",
    });
  });
  it.each(["product", "activity"] as const)(
    "does not claim a %s commitment has started",
    (parent) => {
      const original = {
        id: randomUUID(),
        stableId: randomUUID(),
        projectId: parent === "product" ? randomUUID() : null,
        activityId: parent === "activity" ? randomUUID() : null,
        stageNames: parent === "product" ? ["Development"] : [],
        type: "next" as const,
        workflowStatus: "planned" as const,
        text: "Implement authorisation",
        tag: "feature",
        carriedOver: false,
        pausedReason: null,
        priorityRank: 1,
      };
      const source = structuredClone(original);
      const result = cloneCarriedItem(
        randomUUID(),
        randomUUID(),
        source,
        new Date("2026-09-07T00:00:00Z"),
      );
      expect(result.item).toMatchObject({
        stableId: source.stableId,
        type: "current",
        workflowStatus: "planned",
        carriedOver: true,
        text: source.text,
        priorityRank: source.priorityRank,
      });
      expect(result.item.id).not.toBe(source.id);
      expect(
        draftSaveSchema.safeParse({
          reportSectionId: randomUUID(),
          version: 1,
          status: "draft",
          projectStatuses: [],
          stageStatuses: [],
          activityStatuses: [],
          items: [result.item],
          risks: [],
          decisions: [],
        }).success,
      ).toBe(true);
      expect(source).toEqual(original);
      expect(result.record.sourceItemId).toBe(source.id);
      expect(result.record.targetItemId).toBe(result.item.id);
    },
  );

  it("continues one stable lineage across successive period commitments", () => {
    const sourceReportId = randomUUID();
    const middleReportId = randomUUID();
    const targetReportId = randomUUID();
    const stableId = randomUUID();
    const firstSource = section({
      reportId: sourceReportId,
      items: [
        {
          id: randomUUID(),
          stableId,
          projectId: randomUUID(),
          type: "current",
          text: "API implementation completed",
          nextStepText: "Validate the API",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
    });
    const middleTarget = {
      ...section({ reportId: middleReportId, items: [] }),
      authorId: firstSource.authorId,
      projects: firstSource.projects,
    };
    const firstEntry = expectDefined(
      planCarriedEntries(
        [firstSource],
        [middleTarget],
        sourceReportId,
        middleReportId,
        new Date("2026-09-07T00:00:00.000Z"),
      )[0],
    );
    const firstClone = expectDefined(firstEntry.items[0]).item;

    const middleSource = {
      ...middleTarget,
      items: [
        {
          ...firstClone,
          text: "API validation completed",
          nextStepText: "Release the API",
          workflowStatus: "in_progress" as const,
        },
      ],
    };
    const finalTarget = {
      ...section({ reportId: targetReportId, items: [] }),
      authorId: firstSource.authorId,
      projects: middleTarget.projects,
    };
    const secondEntry = expectDefined(
      planCarriedEntries(
        [middleSource],
        [finalTarget],
        middleReportId,
        targetReportId,
        new Date("2026-09-14T00:00:00.000Z"),
      )[0],
    );
    const secondClone = expectDefined(secondEntry.items[0]).item;

    expect(firstClone).toMatchObject({
      stableId,
      text: "Validate the API",
      nextStepText: null,
      workflowStatus: "planned",
    });
    expect(secondClone).toMatchObject({
      stableId,
      text: "Release the API",
      nextStepText: null,
      workflowStatus: "planned",
    });
    expect(firstClone.id).not.toBe(expectDefined(firstSource.items[0]).id);
    expect(secondClone.id).not.toBe(firstClone.id);
    expect(expectDefined(firstSource.items[0]).text).toBe(
      "API implementation completed",
    );
    expect(expectDefined(middleSource.items[0]).text).toBe(
      "API validation completed",
    );
  });
});
