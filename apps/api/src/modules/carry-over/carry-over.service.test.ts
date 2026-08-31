import type {
  CarryOverExecution,
  CarryOverRecord,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  CarryOverDomainError,
  type CarryOverRepository,
  CarryOverService,
} from "./carry-over.service";
import { cloneCarriedItem, cloneUnresolvedDecision } from "./carry-over-clones";
import { buildCarryOverExecution, planCarriedEntries } from "./carry-over-plan";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";
const unrelatedAuthorId = "66666666-6666-4666-8666-666666666666";

const sourceSection: ReportSectionReadModel = {
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: sourceReportId,
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Lead 1",
  authorRole: "lead",
  version: 1,
  status: "submitted",
  submittedAt: new Date("2026-04-09T10:00:00.000Z"),
  late: false,
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      projectName: "Project 1",
      trafficLight: "yellow",
      ownedStages: [],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  referencedProjects: [],
  items: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "next",
      text: "Move this into next period",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
    },
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Do not carry this one",
      tag: "support",
      workflowStatus: "done",
      carriedOver: false,
      stageNames: ["Development"],
    },
  ],
  risks: [],
  decisions: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      text: "Unresolved decision",
      owner: "Department Head",
      deadline: null,
      impact: "Needs follow-up",
      resolvedAt: null,
      // Decision.productId is a NOT-NULL product FK; a carried decision needs
      // a product to persist (and therefore to be counted).
      productId: "44444444-4444-4444-8444-444444444444",
      stageNames: ["Development"],
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      text: "Resolved decision",
      owner: "Department Head",
      deadline: null,
      impact: "Already done",
      resolvedAt: new Date("2026-04-08T12:00:00.000Z"),
      stageNames: ["Development"],
    },
  ],
  activities: [],
  reviews: [],
};

function createRepository(
  section: ReportSectionReadModel,
  // activity-first-class: the target period's re-attached activities. Defaults
  // to the source's set (the common case); a test passes `[]` to model an
  // activity archived/detached between periods (decision 0.3).
  targetActivities: ReportSectionReadModel["activities"] = section.activities,
  // Which side holds no sections; defaults to neither so both sides carry the
  // source section. Empty-source and empty-target are the two failure modes.
  emptySide: "source" | "target" | "neither" = "neither",
  additionalTargetSections: ReportSectionReadModel[] = [],
): CarryOverRepository {
  const executions = new Map<string, CarryOverExecution>();
  let targetSection: ReportSectionReadModel = {
    ...section,
    reportSectionId: "22222222-2222-4222-8222-222222222223",
    reportId: targetReportId,
    status: "draft",
    submittedAt: null,
    items: [],
    decisions: [],
    activities: targetActivities,
  };
  let records: CarryOverRecord[] = [];

  return {
    findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return Promise.resolve(structuredClone(execution));
        }
      }
      return Promise.resolve(null);
    },
    findPreviousReportId() {
      return Promise.resolve(null);
    },
    getSourceSections() {
      return Promise.resolve(
        emptySide === "source" ? [] : [structuredClone(section)],
      );
    },
    getTargetSections() {
      return Promise.resolve(
        emptySide === "target"
          ? []
          : [
              structuredClone(targetSection),
              ...structuredClone(additionalTargetSections),
            ],
      );
    },
    getTargetReportState() {
      return Promise.resolve({
        status: "draft" as const,
        periodState: "open" as const,
        periodStatus: "open" as const,
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      });
    },
    saveCarryOver(
      execution: CarryOverExecution,
      nextRecords: CarryOverRecord[],
      nextSections: ReportSectionReadModel[],
    ) {
      executions.set(execution.id, structuredClone(execution));
      records = structuredClone(nextRecords);
      targetSection = structuredClone(expectDefined(nextSections[0]));
      return Promise.resolve({
        execution: structuredClone(execution),
        records: structuredClone(records),
        targetSection: structuredClone(targetSection),
      });
    },
  };
}

describe("CarryOverService", () => {
  it("ignores an unrelated submitted target section", async () => {
    const unrelatedSubmitted: ReportSectionReadModel = {
      ...sourceSection,
      reportSectionId: "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      reportId: targetReportId,
      authorId: unrelatedAuthorId,
      authorName: "Lead Beta",
      status: "submitted" as const,
      submittedAt: new Date("2026-04-09T10:00:00.000Z"),
    };
    const repo = createRepository(sourceSection, undefined, "neither", [
      unrelatedSubmitted,
    ]);
    const saved = vi.spyOn(repo, "saveCarryOver");
    const result = await new CarryOverService(repo).executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.records).toHaveLength(2);
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0]?.[2]).toHaveLength(1);
    expect(saved.mock.calls[0]?.[2][0]?.authorId).toBe(sourceSection.authorId);
  });

  it("carries only next-period items and unresolved decisions into the target section", async () => {
    const service = new CarryOverService(createRepository(sourceSection));
    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.targetSection.items).toHaveLength(1);
    expect(result.targetSection.items[0]?.text).toBe(
      "Move this into next period",
    );
    expect(result.targetSection.items[0]?.type).toBe("current");
    expect(result.targetSection.decisions).toHaveLength(1);
    expect(result.targetSection.decisions[0]?.text).toBe("Unresolved decision");
  });

  it("marks carry-over lineage and becomes a no-op on replay", async () => {
    const service = new CarryOverService(createRepository(sourceSection));
    const first = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );
    const second = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(first.records).toHaveLength(2);
    expect(second.execution.id).toBe(first.execution.id);
    expect(second.targetSection.items).toHaveLength(1);
  });

  it("rejects carry-over when source and target report are identical", async () => {
    const service = new CarryOverService(createRepository(sourceSection));

    await expect(
      service.executeCarryOver(sourceReportId, sourceReportId),
    ).rejects.toBeInstanceOf(CarryOverDomainError);
  });

  // A lineage the target section already holds must NOT be carried again — the
  // (reportSectionId, stableId) uniqueness would otherwise skip the item insert
  // (orphaning its CarryOverRecord) or trip P2002 on the decision insert.
  it("skips carrying a lineage the target section already holds", async () => {
    const LINEAGE = "a0000000-0000-4000-8000-0000000000ab";
    const projectId = "44444444-4444-4444-8444-444444444444";
    const src: ReportSectionReadModel = {
      ...sourceSection,
      items: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          stableId: LINEAGE,
          projectId,
          type: "next",
          text: "Same lineage as target",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
      decisions: [],
    };
    // The target already contains the same lineage (e.g. an earlier carry).
    const target: ReportSectionReadModel = {
      ...src,
      reportSectionId: "22222222-2222-4222-8222-222222222223",
      reportId: targetReportId,
      status: "draft",
      submittedAt: null,
      items: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          stableId: LINEAGE,
          projectId,
          type: "current",
          text: "Same lineage as target",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: true,
          stageNames: ["Development"],
        },
      ],
    };
    const repo: CarryOverRepository = {
      findExecutionByDedupeKey: () => Promise.resolve(null),
      findPreviousReportId: () => Promise.resolve(null),
      getSourceSections: () => Promise.resolve([structuredClone(src)]),
      getTargetSections: () => Promise.resolve([structuredClone(target)]),
      getTargetReportState: () =>
        Promise.resolve({
          status: "draft" as const,
          periodState: "open" as const,
          periodStatus: "open" as const,
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        }),
      saveCarryOver: (execution, records, sections) =>
        Promise.resolve({
          execution,
          records,
          targetSection: expectDefined(sections[0]),
        }),
    };
    const service = new CarryOverService(repo);
    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // The lineage is already present → not carried again: no records, no count.
    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.records).toHaveLength(0);
    // And the target still holds exactly one row for that lineage (no duplicate).
    expect(
      result.targetSection.items.filter((i) => i.stableId === LINEAGE),
    ).toHaveLength(1);
  });

  describe("carry-over — findMany and idempotency", () => {
    const secondSourceSection: ReportSectionReadModel = {
      ...sourceSection,
      reportSectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      authorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      authorName: "Lead 2",
      items: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          projectId: "44444444-4444-4444-8444-444444444444",
          type: "next",
          text: "Lead 2 next item",
          tag: "bugfix",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
      decisions: [],
    };

    const thirdSourceSection: ReportSectionReadModel = {
      ...sourceSection,
      reportSectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      authorId: "12345678-1234-4234-8234-123456789abc",
      authorName: "Lead 3",
      items: [
        {
          id: "fafafafa-fafa-4faf-8faf-fafafafafafa",
          projectId: "44444444-4444-4444-8444-444444444444",
          type: "next",
          text: "Lead 3 next item",
          tag: "infra",
          workflowStatus: "planned",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
      decisions: [],
    };

    function createMultiSectionRepository(
      sources: ReportSectionReadModel[],
    ): CarryOverRepository {
      const executions = new Map<string, CarryOverExecution>();
      const targetSections = sources.map((s) => ({
        ...s,
        reportSectionId: crypto.randomUUID(),
        reportId: targetReportId,
        status: "draft" as const,
        submittedAt: null,
        items: [],
        decisions: [],
      }));
      let savedRecords: CarryOverRecord[] = [];

      return {
        findExecutionByDedupeKey(dedupeKey: string) {
          for (const execution of executions.values()) {
            if (execution.dedupeKey === dedupeKey) {
              return Promise.resolve(structuredClone(execution));
            }
          }
          return Promise.resolve(null);
        },
        findPreviousReportId() {
          return Promise.resolve(null);
        },
        getSourceSections() {
          return Promise.resolve(sources.map((s) => structuredClone(s)));
        },
        getTargetSections() {
          return Promise.resolve(targetSections.map((s) => structuredClone(s)));
        },
        getTargetReportState() {
          return Promise.resolve({
            status: "draft" as const,
            periodState: "open" as const,
            periodStatus: "open" as const,
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
          });
        },
        saveCarryOver(
          execution: CarryOverExecution,
          nextRecords: CarryOverRecord[],
          nextSections: ReportSectionReadModel[],
        ) {
          executions.set(execution.id, structuredClone(execution));
          savedRecords = structuredClone(nextRecords);
          return Promise.resolve({
            execution: structuredClone(execution),
            records: structuredClone(savedRecords),
            targetSection: structuredClone(expectDefined(nextSections[0])),
          });
        },
      };
    }

    it("processes ALL source sections (3 sections = items from all 3)", async () => {
      const repo = createMultiSectionRepository([
        sourceSection,
        secondSourceSection,
        thirdSourceSection,
      ]);
      const service = new CarryOverService(repo);
      const result = await service.executeCarryOver(
        sourceReportId,
        targetReportId,
      );

      // sourceSection: 1 next item + 1 unresolved decision = 2 records;
      // secondSourceSection: 1 next item; thirdSourceSection: 1 next item
      // → 4 total.
      expect(result.records).toHaveLength(4);
      expect(result.execution.carriedItemCount).toBe(3);
      expect(result.execution.carriedDecisionCount).toBe(1);
    });

    it("returns existing execution without creating new records (idempotency)", async () => {
      const repo = createRepository(sourceSection);
      const service = new CarryOverService(repo);

      const first = await service.executeCarryOver(
        sourceReportId,
        targetReportId,
      );
      const second = await service.executeCarryOver(
        sourceReportId,
        targetReportId,
      );

      expect(second.execution.id).toBe(first.execution.id);
      // Idempotent replay returns empty records array
      expect(second.records).toHaveLength(0);
    });

    it("creates a new execution when none exists", async () => {
      const repo = createRepository(sourceSection);
      const service = new CarryOverService(repo);
      const result = await service.executeCarryOver(
        sourceReportId,
        targetReportId,
      );

      expect(result.execution.status).toBe("completed");
      expect(result.execution.dedupeKey).toBe(
        `${sourceReportId}:${targetReportId}`,
      );
      expect(result.records.length).toBeGreaterThan(0);
    });

    it("throws when source sections are empty", async () => {
      const repo = createRepository(sourceSection, undefined, "source");
      const service = new CarryOverService(repo);

      await expect(
        service.executeCarryOver(sourceReportId, targetReportId),
      ).rejects.toBeInstanceOf(CarryOverDomainError);
    });

    it("throws when target sections are empty", async () => {
      const repo = createRepository(sourceSection, undefined, "target");
      const service = new CarryOverService(repo);

      await expect(
        service.executeCarryOver(sourceReportId, targetReportId),
      ).rejects.toBeInstanceOf(CarryOverDomainError);
    });
  });
});

// activity-first-class (LOCKED decision 0.3): an activity-parented record is
// carried only when its activity is re-attached to the target section; an
// archived/detached activity's records are dropped, not carried forward.
describe("CarryOverService — activity-parented carry-over", () => {
  const ACTIVITY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const activitySource: ReportSectionReadModel = {
    ...sourceSection,
    items: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        activityId: ACTIVITY_ID,
        type: "next",
        text: "Activity next-week item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [],
      },
    ],
    decisions: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        activityId: ACTIVITY_ID,
        text: "Unresolved activity decision",
        owner: "Lead 1",
        deadline: null,
        impact: "Follow up",
        resolvedAt: null,
        stageNames: [],
      },
    ],
    activities: [
      {
        activityId: ACTIVITY_ID,
        activityName: "Jira triage duty",
        status: "green",
        linkedProducts: [],
        derivedStatus: "green",
        alarmFloor: null,
      },
    ],
  };

  it("carries the records when the activity is re-attached in the target period", async () => {
    const service = new CarryOverService(createRepository(activitySource));
    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.targetSection.items).toHaveLength(1);
    expect(result.targetSection.items[0]?.activityId).toBe(ACTIVITY_ID);
    expect(result.targetSection.decisions).toHaveLength(1);
    expect(result.targetSection.decisions[0]?.activityId).toBe(ACTIVITY_ID);
    expect(result.records).toHaveLength(2);
  });

  it("drops the clone when the activity is not re-attached", async () => {
    const service = new CarryOverService(
      // Empty target activities model an archived/detached activity.
      createRepository(activitySource, []),
    );
    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.targetSection.items).toHaveLength(0);
    expect(result.targetSection.decisions).toHaveLength(0);
    expect(result.records).toHaveLength(0);
  });
});

// Lifecycle timestamps arrive from the boundary, not the transaction builder:
// one run shares a single provided instant across the execution and records.
describe("carry-over plan — boundary-provided lifecycle timestamps", () => {
  const NOW = new Date("2026-05-04T09:30:00.000Z");

  it("builds the execution from the boundary-provided instant", () => {
    const execution = buildCarryOverExecution({
      sourceReportId,
      targetReportId,
      dedupeKey: `${sourceReportId}:${targetReportId}`,
      carriedItemCount: 2,
      carriedDecisionCount: 1,
      now: NOW,
    });

    expect(execution.startedAt).toEqual(NOW);
    expect(execution.completedAt).toEqual(NOW);
  });

  it("stamps every carried record with the same boundary-provided instant", () => {
    const item = expectDefined(sourceSection.items[0]);
    const decision = expectDefined(sourceSection.decisions[0]);
    const itemClone = cloneCarriedItem(
      sourceReportId,
      targetReportId,
      item,
      NOW,
    );
    const decisionClone = cloneUnresolvedDecision(
      sourceReportId,
      targetReportId,
      decision,
      NOW,
    );

    expect(itemClone.record.carriedAt).toEqual(NOW);
    expect(decisionClone.record.carriedAt).toEqual(NOW);
  });

  it("plans one run with one shared instant across clones", () => {
    const entries = planCarriedEntries(
      [sourceSection],
      [
        {
          ...sourceSection,
          reportSectionId: "22222222-2222-4222-8222-222222222223",
          reportId: targetReportId,
          status: "draft",
          submittedAt: null,
          items: [],
          decisions: [],
        },
      ],
      sourceReportId,
      targetReportId,
      NOW,
    );

    const timestamps = entries.flatMap((entry) =>
      [...entry.items, ...entry.decisions].map(
        (carried) => carried.record.carriedAt,
      ),
    );
    expect(timestamps).toHaveLength(2);
    expect(timestamps.every((stamp) => stamp.getTime() === NOW.getTime())).toBe(
      true,
    );
  });
});
