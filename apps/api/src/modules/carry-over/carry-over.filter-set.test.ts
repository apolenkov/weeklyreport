import type {
  CarryOverExecution,
  CarryOverRecord,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  type CarryOverRepository,
  CarryOverService,
} from "./carry-over.service";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";

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
      return Promise.resolve([structuredClone(section)]);
    },
    getTargetSections() {
      return Promise.resolve([structuredClone(targetSection)]);
    },
    getTargetReportState() {
      return Promise.resolve({
        periodStatus: "open" as const,
        archived: false,
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

// Pin of the exact carry filter set enforced by executeCarryOver: locks every
// exclusion branch (incl. the `workflowStatus: "postponed"` drop) so a reshuffle
// of the item/decision filters is caught before it changes which rows carry.
describe("CarryOverService — carry filter set (pin)", () => {
  const AUTHOR = "33333333-3333-4333-8333-333333333333";
  const PROJECT = "44444444-4444-4444-8444-444444444444";
  const ACTIVITY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const LINEAGE = "a0000000-0000-4000-8000-0000000000cd";
  const REATTACHED: ReportSectionReadModel["activities"] = [
    {
      activityId: ACTIVITY,
      activityName: "Reattached activity",
      status: "green",
      linkedProducts: [],
      derivedStatus: "green",
      alarmFloor: null,
    },
  ];

  const nextItem = (
    over: Partial<ReportSectionReadModel["items"][number]> = {},
  ): ReportSectionReadModel["items"][number] => ({
    id: crypto.randomUUID(),
    projectId: PROJECT,
    type: "next",
    text: "candidate",
    tag: "feature",
    workflowStatus: "in_progress",
    carriedOver: false,
    ...over,
    stageNames:
      over.stageNames ?? (over.activityId != null ? [] : ["Development"]),
  });

  const unresolvedDecision = (
    over: Partial<ReportSectionReadModel["decisions"][number]> = {},
  ): ReportSectionReadModel["decisions"][number] => ({
    id: crypto.randomUUID(),
    productId: PROJECT,
    text: "candidate decision",
    owner: "Department Head",
    deadline: null,
    impact: "Follow up",
    resolvedAt: null,
    ...over,
    stageNames:
      over.stageNames ?? (over.activityId != null ? [] : ["Development"]),
  });

  function pinRepo(opts: {
    items?: ReportSectionReadModel["items"];
    decisions?: ReportSectionReadModel["decisions"];
    targetActivities?: ReportSectionReadModel["activities"];
    targetItems?: ReportSectionReadModel["items"];
    targetDecisions?: ReportSectionReadModel["decisions"];
  }): CarryOverRepository {
    const source: ReportSectionReadModel = {
      ...sourceSection,
      authorId: AUTHOR,
      items: opts.items ?? [],
      decisions: opts.decisions ?? [],
      activities: [],
    };
    const target: ReportSectionReadModel = {
      ...sourceSection,
      reportSectionId: "22222222-2222-4222-8222-222222222223",
      reportId: targetReportId,
      authorId: AUTHOR,
      status: "draft",
      submittedAt: null,
      items: opts.targetItems ?? [],
      decisions: opts.targetDecisions ?? [],
      activities: opts.targetActivities ?? [],
    };
    return {
      findExecutionByDedupeKey: () => Promise.resolve(null),
      findPreviousReportId: () => Promise.resolve(null),
      getSourceSections: () => Promise.resolve([structuredClone(source)]),
      getTargetSections: () => Promise.resolve([structuredClone(target)]),
      getTargetReportState: () =>
        Promise.resolve({ periodStatus: "open" as const, archived: false }),
      saveCarryOver: (execution, records, sections) =>
        Promise.resolve({
          execution,
          records,
          targetSection: expectDefined(sections[0]),
        }),
    };
  }

  it.each([
    {
      name: "carries a fresh next item",
      opts: { items: [nextItem()] },
      items: 1,
    },
    {
      name: "excludes a done next item",
      opts: { items: [nextItem({ workflowStatus: "done" })] },
      items: 0,
    },
    {
      name: "excludes a postponed next item",
      opts: { items: [nextItem({ workflowStatus: "postponed" })] },
      items: 0,
    },
    {
      name: "excludes an already-carried item",
      opts: { items: [nextItem({ carriedOver: true })] },
      items: 0,
    },
    {
      name: "excludes a current (non-next) item",
      opts: { items: [nextItem({ type: "current" })] },
      items: 0,
    },
    {
      name: "carries an activity item when the activity is re-attached",
      opts: {
        items: [nextItem({ projectId: undefined, activityId: ACTIVITY })],
        targetActivities: REATTACHED,
      },
      items: 1,
    },
    {
      name: "excludes an activity item whose activity is not re-attached",
      opts: {
        items: [nextItem({ projectId: undefined, activityId: ACTIVITY })],
      },
      items: 0,
    },
    {
      name: "excludes an item whose stableId already exists in the target lineage",
      opts: {
        items: [nextItem({ stableId: LINEAGE })],
        targetItems: [
          nextItem({ stableId: LINEAGE, type: "current", carriedOver: true }),
        ],
      },
      items: 0,
    },
  ])("$name", async ({ opts, items }) => {
    const result = await new CarryOverService(pinRepo(opts)).executeCarryOver(
      sourceReportId,
      targetReportId,
    );
    expect(result.execution.carriedItemCount).toBe(items);
    expect(result.records).toHaveLength(items);
  });

  it.each([
    {
      name: "carries a fresh unresolved decision",
      opts: { decisions: [unresolvedDecision()] },
      decisions: 1,
    },
    {
      name: "excludes a resolved decision",
      opts: {
        decisions: [
          unresolvedDecision({
            resolvedAt: new Date("2026-04-08T12:00:00.000Z"),
          }),
        ],
      },
      decisions: 0,
    },
    {
      name: "excludes a decision whose stableId already exists in the target lineage",
      opts: {
        decisions: [unresolvedDecision({ stableId: LINEAGE })],
        targetDecisions: [unresolvedDecision({ stableId: LINEAGE })],
      },
      decisions: 0,
    },
    {
      name: "excludes an activity decision whose activity is not re-attached",
      opts: {
        decisions: [
          unresolvedDecision({ productId: undefined, activityId: ACTIVITY }),
        ],
      },
      decisions: 0,
    },
  ])("$name", async ({ opts, decisions }) => {
    const result = await new CarryOverService(pinRepo(opts)).executeCarryOver(
      sourceReportId,
      targetReportId,
    );
    expect(result.execution.carriedDecisionCount).toBe(decisions);
    expect(result.records).toHaveLength(decisions);
  });

  it("merges each author's carried rows into that author's own target section", async () => {
    const authorB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sourceA: ReportSectionReadModel = {
      ...sourceSection,
      authorId: AUTHOR,
      items: [nextItem({ text: "A item" })],
      decisions: [],
      activities: [],
    };
    const sourceB: ReportSectionReadModel = {
      ...sourceSection,
      reportSectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      authorId: authorB,
      items: [nextItem({ text: "B item" })],
      decisions: [],
      activities: [],
    };
    const targets = [sourceA, sourceB].map((s) => ({
      ...s,
      reportSectionId: crypto.randomUUID(),
      reportId: targetReportId,
      status: "draft" as const,
      submittedAt: null,
      items: [],
      decisions: [],
    }));

    const captured: ReportSectionReadModel[][] = [];
    const repo: CarryOverRepository = {
      findExecutionByDedupeKey: () => Promise.resolve(null),
      findPreviousReportId: () => Promise.resolve(null),
      getSourceSections: () =>
        Promise.resolve([structuredClone(sourceA), structuredClone(sourceB)]),
      getTargetSections: () =>
        Promise.resolve(targets.map((t) => structuredClone(t))),
      getTargetReportState: () =>
        Promise.resolve({ periodStatus: "open" as const, archived: false }),
      saveCarryOver: (execution, records, sections) => {
        captured.push(structuredClone(sections));
        return Promise.resolve({
          execution,
          records,
          targetSection: expectDefined(sections[0]),
        });
      },
    };

    await new CarryOverService(repo).executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const persisted = expectDefined(captured[0]);
    const byAuthor = (authorId: string) =>
      expectDefined(persisted.find((s) => s.authorId === authorId));
    expect(byAuthor(AUTHOR).items.map((i) => i.text)).toEqual(["A item"]);
    expect(byAuthor(authorB).items.map((i) => i.text)).toEqual(["B item"]);
  });

  it("rejects duplicate source sections for one carried author", async () => {
    const duplicate = {
      ...sourceSection,
      reportSectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    };
    const repo = createRepository(sourceSection);
    repo.getSourceSections = () =>
      Promise.resolve([
        structuredClone(sourceSection),
        structuredClone(duplicate),
      ]);

    await expect(
      new CarryOverService(repo).executeCarryOver(
        sourceReportId,
        targetReportId,
      ),
    ).rejects.toThrow(
      `Carry-over requires one source section per author; duplicate author ${AUTHOR}.`,
    );
  });
});
