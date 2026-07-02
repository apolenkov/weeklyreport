import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  type CarryOverRepository,
  CarryOverService,
} from "./carry-over.service";
import { computeUncarriedOpenWork } from "./carry-over-uncarried";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const NEXT_ITEM_LINEAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_LINEAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeSourceSection(): ReportSectionReadModel {
  return {
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    reportId: sourceReportId,
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Lead 1",
    version: 1,
    status: "submitted",
    submittedAt: new Date("2026-06-19T10:00:00.000Z"),
    projects: [
      { projectId: PROJECT_ID, projectName: "Project 1", trafficLight: null },
    ],
    items: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        stableId: NEXT_ITEM_LINEAGE,
        projectId: PROJECT_ID,
        type: "next",
        text: "Planned but never carried",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
      },
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        stableId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        projectId: PROJECT_ID,
        type: "current",
        text: "Done current item",
        tag: "support",
        workflowStatus: "done",
        completed: true,
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        stableId: DECISION_LINEAGE,
        text: "Unresolved decision",
        owner: "Head",
        deadline: null,
        impact: "Needs follow-up",
        resolvedAt: null,
        productId: PROJECT_ID,
      },
      {
        id: "99999999-9999-4999-8999-999999999998",
        stableId: "99999999-9999-4999-8999-999999999997",
        text: "Resolved decision",
        owner: "Head",
        deadline: null,
        impact: "Closed",
        resolvedAt: new Date("2026-06-18T12:00:00.000Z"),
        productId: PROJECT_ID,
      },
    ],
    activities: [],
  };
}

function makeTargetSection(
  items: ReportSectionReadModel["items"] = [],
  decisions: ReportSectionReadModel["decisions"] = [],
): ReportSectionReadModel {
  return {
    ...makeSourceSection(),
    reportSectionId: "22222222-2222-4222-8222-222222222223",
    reportId: targetReportId,
    status: "draft",
    submittedAt: null,
    items,
    decisions,
  };
}

describe("computeUncarriedOpenWork", () => {
  it("surfaces the prior period's carryable open records that are not in the target", () => {
    const result = computeUncarriedOpenWork(
      sourceReportId,
      [makeSourceSection()],
      [makeTargetSection()],
    );
    expect(result.sourceReportId).toBe(sourceReportId);
    expect(result.items.map((item) => item.stableId)).toEqual([
      NEXT_ITEM_LINEAGE,
    ]);
    expect(result.decisions.map((decision) => decision.stableId)).toEqual([
      DECISION_LINEAGE,
    ]);
  });

  it("does not flag a done item or a resolved decision as open work", () => {
    const result = computeUncarriedOpenWork(
      sourceReportId,
      [makeSourceSection()],
      [makeTargetSection()],
    );
    expect(result.items.some((item) => item.text === "Done current item")).toBe(
      false,
    );
    expect(
      result.decisions.some(
        (decision) => decision.text === "Resolved decision",
      ),
    ).toBe(false);
  });

  it("counts an item moved to next week (carriedOver reset) but skips a still-carried one", () => {
    const source = makeSourceSection();
    // "Move to next week" writes type=next, completed=false, carriedOver=false
    // (moveToNextWeekPatch). The reset carriedOver is what lets this signal see
    // the deferred item again.
    const movedSection: ReportSectionReadModel = {
      ...source,
      items: [
        {
          ...source.items[0],
          stableId: NEXT_ITEM_LINEAGE,
          type: "next",
          completed: false,
          carriedOver: false,
        },
      ],
      decisions: [],
    };
    const moved = computeUncarriedOpenWork(
      sourceReportId,
      [movedSection],
      [makeTargetSection()],
    );
    expect(moved.items.map((item) => item.stableId)).toEqual([
      NEXT_ITEM_LINEAGE,
    ]);

    // The shape where carriedOver is left true is skipped: without the reset, a
    // carried item moved forward would never resurface in this signal.
    const stuckSection: ReportSectionReadModel = {
      ...movedSection,
      items: [{ ...movedSection.items[0], carriedOver: true }],
    };
    const stuck = computeUncarriedOpenWork(
      sourceReportId,
      [stuckSection],
      [makeTargetSection()],
    );
    expect(stuck.items).toHaveLength(0);
  });

  it("does not flag a done next-week item (finished work is not carried)", () => {
    const source = makeSourceSection();
    const doneNext: ReportSectionReadModel = {
      ...source,
      items: [
        {
          ...source.items[0],
          stableId: NEXT_ITEM_LINEAGE,
          type: "next",
          workflowStatus: "done",
          completed: true,
          carriedOver: false,
        },
      ],
      decisions: [],
    };
    const result = computeUncarriedOpenWork(
      sourceReportId,
      [doneNext],
      [makeTargetSection()],
    );
    expect(result.items).toHaveLength(0);
  });

  it("does not surface a source author who has no matching target section", () => {
    // execute carries a source author's records only into that same author's
    // target section; a source-only author is skipped. Surfacing them would
    // promise a copy the one-click button can never make (a false-success
    // no-op), so the signal must skip them too.
    const orphanTarget: ReportSectionReadModel = {
      ...makeTargetSection(),
      authorId: "88888888-8888-4888-8888-888888888888",
      authorName: "Other Lead",
    };
    const result = computeUncarriedOpenWork(
      sourceReportId,
      [makeSourceSection()],
      [orphanTarget],
    );
    expect(result.items).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
  });

  it("treats a record whose lineage exists in the target as carried", () => {
    const source = makeSourceSection();
    const carriedItem = {
      ...source.items[0],
      id: "12121212-1212-4121-8121-121212121212",
      type: "current" as const,
      carriedOver: true,
    };
    const carriedDecision = {
      ...source.decisions[0],
      id: "13131313-1313-4131-8131-131313131313",
    };
    const result = computeUncarriedOpenWork(
      sourceReportId,
      [source],
      [makeTargetSection([carriedItem], [carriedDecision])],
    );
    expect(result.items).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
  });
});

describe("CarryOverService.listUncarriedOpenWork", () => {
  function createRepository(
    previousId: string | null,
  ): CarryOverRepository & { saveCalls: number } {
    const repo = {
      saveCalls: 0,
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async findExecutionByDedupeKey() {
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async findPreviousReportId() {
        return previousId;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async getSourceSections() {
        return [makeSourceSection()];
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async getTargetSections() {
        return [makeTargetSection()];
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async getTargetReportState() {
        return { periodStatus: "open" as const, archived: false };
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- repository-contract stub; no awaitable work
      async saveCarryOver(): Promise<never> {
        repo.saveCalls += 1;
        throw new Error("listUncarriedOpenWork must never write");
      },
    };
    return repo;
  }

  it("returns the read-only signal without writing anything", async () => {
    const repository = createRepository(sourceReportId);
    const service = new CarryOverService(repository);
    const result = await service.listUncarriedOpenWork(targetReportId);
    expect(result.items).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(repository.saveCalls).toBe(0);
  });

  it("resolves empty when no prior period exists", async () => {
    const service = new CarryOverService(createRepository(null));
    const result = await service.listUncarriedOpenWork(targetReportId);
    expect(result.sourceReportId).toBeNull();
    expect(result.items).toHaveLength(0);
  });

  it("goes silent once a carry-over execution already exists (one-shot)", async () => {
    const repository = createRepository(sourceReportId);
    // A prior execution for this (source, target): the one-click remedy is
    // spent, so the signal must not re-surface records it can no longer move.
    repository.findExecutionByDedupeKey = () =>
      Promise.resolve({ id: "exec" } as never);
    const service = new CarryOverService(repository);
    const result = await service.listUncarriedOpenWork(targetReportId);
    expect(result.sourceReportId).toBeNull();
    expect(result.items).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
  });
});
