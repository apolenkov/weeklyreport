import { randomUUID } from "node:crypto";

import {
  draftSaveSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined";
import { cloneCarriedItem, cloneUnresolvedDecision } from "./carry-over-clones";
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

  it("carries an explicitly replanned occurrence across A to B to C", () => {
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
          type: "next",
          text: "Validate the API",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          priorityRank: 2,
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

    // The lead explicitly moves the unconfirmed Current B occurrence back to
    // Next B. This is a plan, so only placement and the marker change.
    const middleSource = {
      ...middleTarget,
      items: [
        {
          ...firstClone,
          type: "next" as const,
          carriedOver: false,
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
      priorityRank: 2,
      carriedOver: true,
    });
    expect(secondClone).toMatchObject({
      stableId,
      text: "Validate the API",
      nextStepText: null,
      workflowStatus: "planned",
      priorityRank: 2,
      carriedOver: true,
    });
    expect(firstClone.id).not.toBe(expectDefined(firstSource.items[0]).id);
    expect(secondClone.id).not.toBe(firstClone.id);
    expect(expectDefined(firstSource.items[0]).text).toBe("Validate the API");
    expect(expectDefined(firstSource.items[0]).carriedOver).toBe(false);
    expect(expectDefined(middleSource.items[0]).carriedOver).toBe(false);
  });
});

// Read models carry review and audit metadata the write boundary never
// accepts; clones must project only the fields the row writes persist.
describe("carry-over clone write-field projection", () => {
  it("drops comments, resolution and outcome history from an item clone", () => {
    const outcomeState = {
      type: "current" as const,
      workflowStatus: "in_progress" as const,
      pausedReason: null,
      nextStepText: null,
      text: "API implemented",
    };
    const source = {
      id: randomUUID(),
      stableId: randomUUID(),
      projectId: randomUUID(),
      activityId: null,
      type: "current" as const,
      workflowStatus: "in_progress" as const,
      text: "API implemented",
      nextStepText: "Run integration tests",
      tag: "feature",
      carriedOver: false,
      priorityRank: 3,
      pausedReason: null,
      stageNames: ["Development"],
      comments: [
        {
          id: randomUUID(),
          reviewerId: randomUUID(),
          reviewerName: "Head",
          text: "Check the edge cases",
          createdAt: new Date("2026-09-05T10:00:00.000Z"),
        },
      ],
      resolution: {
        kind: "wont_do" as const,
        eventId: randomUUID(),
        reason: "Descoped",
        actorId: randomUUID(),
        actorName: "Head",
        occurredAt: "2026-09-06T09:00:00.000Z",
        previousState: outcomeState,
      },
      outcomeHistory: [
        {
          id: randomUUID(),
          stableId: randomUUID(),
          outcome: "continue" as const,
          reason: null,
          actorId: randomUUID(),
          actorName: "Head",
          occurredAt: "2026-09-06T09:00:00.000Z",
          beforeState: outcomeState,
          afterState: outcomeState,
          reversesEventId: null,
        },
      ],
    };
    const original = structuredClone(source);

    const { item, record } = cloneCarriedItem(
      randomUUID(),
      randomUUID(),
      source,
      new Date("2026-09-07T00:00:00.000Z"),
    );

    expect(item).not.toHaveProperty("comments");
    expect(item).not.toHaveProperty("resolution");
    expect(item).not.toHaveProperty("outcomeHistory");
    expect(item).toMatchObject({
      stableId: source.stableId,
      projectId: source.projectId,
      activityId: null,
      type: "current",
      text: "Run integration tests",
      tag: "feature",
      workflowStatus: "planned",
      carriedOver: true,
      priorityRank: 3,
      pausedReason: null,
      nextStepText: null,
      stageNames: ["Development"],
    });
    expect(item.id).not.toBe(source.id);
    expect(record.sourceItemId).toBe(source.id);
    expect(record.targetItemId).toBe(item.id);
    expect(source).toEqual(original);
  });

  it("drops comments and keeps write fields on a decision clone", () => {
    const deadline = new Date("2026-09-30T00:00:00.000Z");
    const source = {
      id: randomUUID(),
      stableId: randomUUID(),
      text: "Escalate vendor risk",
      owner: "Department Head",
      deadline,
      impact: "Blocks the release",
      resolvedAt: null,
      stageNames: ["Development"],
      productId: randomUUID(),
      activityId: null,
      comments: [
        {
          id: randomUUID(),
          reviewerId: randomUUID(),
          reviewerName: "Head",
          text: "Confirm the date",
          createdAt: new Date("2026-09-05T10:00:00.000Z"),
        },
      ],
    };
    const original = structuredClone(source);

    const { decision, record } = cloneUnresolvedDecision(
      randomUUID(),
      randomUUID(),
      source,
      new Date("2026-09-07T00:00:00.000Z"),
    );

    expect(decision).not.toHaveProperty("comments");
    expect(decision).toMatchObject({
      stableId: source.stableId,
      text: "Escalate vendor risk",
      owner: "Department Head",
      deadline,
      impact: "Blocks the release",
      resolvedAt: null,
      stageNames: ["Development"],
      productId: source.productId,
      activityId: null,
    });
    expect(decision.id).not.toBe(source.id);
    expect(record.sourceDecisionId).toBe(source.id);
    expect(record.targetDecisionId).toBe(decision.id);
    expect(source).toEqual(original);
  });
});

// Selection is per lineage (stableId), never per source row: at most one
// active target occurrence, an explicit commitment beating the in-progress
// continuation regardless of source order.
describe("carry-over selects one rollover target per lineage", () => {
  const sourceItem = (
    over: Partial<ReportSectionReadModel["items"][number]> = {},
  ): ReportSectionReadModel["items"][number] => ({
    id: randomUUID(),
    stableId: randomUUID(),
    type: "current",
    workflowStatus: "in_progress",
    text: "candidate",
    tag: "feature",
    carriedOver: false,
    stageNames: ["Development"],
    ...over,
  });

  const emptyTargetFor = (
    source: ReportSectionReadModel,
    reportId: string,
    items: ReportSectionReadModel["items"] = [],
  ): ReportSectionReadModel => ({
    ...section({ reportId, items }),
    authorId: source.authorId,
    projects: source.projects,
  });

  const plan = (
    source: ReportSectionReadModel,
    target: ReportSectionReadModel,
  ) =>
    planCarriedEntries(
      [source],
      [target],
      source.reportId,
      target.reportId,
      new Date("2026-09-14T00:00:00.000Z"),
    );

  it("continues a bare in-progress Current item once as in_progress", () => {
    const stableId = randomUUID();
    const sourceReportId = randomUUID();
    const targetReportId = randomUUID();
    const source = section({
      reportId: sourceReportId,
      items: [
        sourceItem({
          stableId,
          text: "API integration still running",
          carriedOver: true,
          priorityRank: 4,
          pausedReason: null,
          nextStepText: null,
        }),
      ],
    });
    const snapshot = structuredClone(source);

    const entry = expectDefined(
      plan(source, emptyTargetFor(source, targetReportId))[0],
    );

    expect(entry.items).toHaveLength(1);
    const clone = expectDefined(entry.items[0]);
    expect(clone.item).toMatchObject({
      stableId,
      type: "current",
      workflowStatus: "in_progress",
      text: "API integration still running",
      tag: "feature",
      carriedOver: true,
      priorityRank: 4,
      pausedReason: null,
      nextStepText: null,
      stageNames: ["Development"],
    });
    expect(clone.item.id).not.toBe(expectDefined(source.items[0]).id);
    expect(clone.record.sourceItemId).toBe(expectDefined(source.items[0]).id);
    expect(clone.record.targetItemId).toBe(clone.item.id);
    expect(
      draftSaveSchema.safeParse({
        reportSectionId: randomUUID(),
        version: 1,
        status: "draft",
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [clone.item],
        risks: [],
        decisions: [],
      }).success,
    ).toBe(true);
    expect(source).toEqual(snapshot);
  });

  it.each(["commitment first", "fallback first"] as const)(
    "lets an explicit next commitment win over an in-progress twin (%s)",
    (order) => {
      const stableId = randomUUID();
      const continuation = sourceItem({
        stableId,
        text: "Beta still running",
        carriedOver: true,
        priorityRank: 1,
      });
      const commitment = sourceItem({
        stableId,
        type: "next",
        workflowStatus: "planned",
        text: "Ship the beta",
        priorityRank: 2,
      });
      const source = section({
        reportId: randomUUID(),
        items:
          order === "commitment first"
            ? [commitment, continuation]
            : [continuation, commitment],
      });
      const targetReportId = randomUUID();

      const entry = expectDefined(
        plan(source, emptyTargetFor(source, targetReportId))[0],
      );

      expect(entry.items).toHaveLength(1);
      const clone = expectDefined(entry.items[0]);
      expect(clone.item).toMatchObject({
        stableId,
        type: "current",
        workflowStatus: "planned",
        text: "Ship the beta",
        carriedOver: true,
        nextStepText: null,
        pausedReason: null,
      });
      expect(clone.record.sourceItemId).toBe(commitment.id);
      expect(source.items).toHaveLength(2);
    },
  );

  it("prefers a Current next-step commitment over its in-progress twin", () => {
    const stableId = randomUUID();
    const continuation = sourceItem({
      stableId,
      text: "Beta still running",
    });
    const commitment = sourceItem({
      stableId,
      workflowStatus: "planned",
      text: "Beta",
      nextStepText: "Ship the beta",
    });
    const source = section({
      reportId: randomUUID(),
      items: [continuation, commitment],
    });
    const targetReportId = randomUUID();

    const entry = expectDefined(
      plan(source, emptyTargetFor(source, targetReportId))[0],
    );

    expect(entry.items).toHaveLength(1);
    const clone = expectDefined(entry.items[0]);
    expect(clone.item).toMatchObject({
      stableId,
      type: "current",
      workflowStatus: "planned",
      text: "Ship the beta",
      carriedOver: true,
      nextStepText: null,
    });
    expect(clone.record.sourceItemId).toBe(commitment.id);
  });

  it("clones duplicate eligible occurrences of one lineage only once", () => {
    const stableId = randomUUID();
    const first = sourceItem({
      stableId,
      type: "next",
      workflowStatus: "planned",
      text: "Ship the beta",
    });
    const duplicate = sourceItem({
      stableId,
      type: "next",
      text: "Ship the beta (restated)",
    });
    const source = section({
      reportId: randomUUID(),
      items: [first, duplicate],
    });
    const targetReportId = randomUUID();

    const entry = expectDefined(
      plan(source, emptyTargetFor(source, targetReportId))[0],
    );

    expect(entry.items).toHaveLength(1);
    expect(expectDefined(entry.items[0]).record.sourceItemId).toBe(first.id);
  });

  it("continues the in-progress twin when its next plan was already carried", () => {
    const stableId = randomUUID();
    const continuation = sourceItem({
      stableId,
      text: "Beta still running",
      carriedOver: true,
    });
    const source = section({
      reportId: randomUUID(),
      items: [
        sourceItem({
          stableId,
          type: "next",
          workflowStatus: "planned",
          text: "Old next plan",
          carriedOver: true,
        }),
        continuation,
      ],
    });
    const targetReportId = randomUUID();

    const entry = expectDefined(
      plan(source, emptyTargetFor(source, targetReportId))[0],
    );

    expect(entry.items).toHaveLength(1);
    const clone = expectDefined(entry.items[0]);
    expect(clone.item).toMatchObject({
      stableId,
      type: "current",
      workflowStatus: "in_progress",
      text: "Beta still running",
      carriedOver: true,
      nextStepText: null,
    });
    expect(clone.record.sourceItemId).toBe(continuation.id);
  });

  it("creates no active clone for uncommitted planned work", () => {
    const source = section({
      reportId: randomUUID(),
      items: [
        sourceItem({
          workflowStatus: "planned",
          text: "Not scheduled for the new week",
        }),
      ],
    });
    const targetReportId = randomUUID();

    const entry = expectDefined(
      plan(source, emptyTargetFor(source, targetReportId))[0],
    );

    expect(entry.items).toHaveLength(0);
  });

  it("does not clone a lineage the target section already holds", () => {
    const stableId = randomUUID();
    const source = section({
      reportId: randomUUID(),
      items: [
        sourceItem({
          stableId,
          text: "Beta still running",
          carriedOver: true,
        }),
      ],
    });
    const targetReportId = randomUUID();
    const target = emptyTargetFor(source, targetReportId, [
      sourceItem({
        stableId,
        text: "Already carried occurrence",
        carriedOver: true,
      }),
    ]);

    const entry = expectDefined(plan(source, target)[0]);

    expect(entry.items).toHaveLength(0);
  });
});
