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
  type CarryOverResult,
  CarryOverService,
  type TargetReportState,
} from "./carry-over.service";
import { createNullLogger } from "../../lib/logger";

const sourceReportId = "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const targetReportId = "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const leadAlphaId = "11110000-1111-4111-8111-111111111111";
const leadBetaId = "22220000-2222-4222-8222-222222222222";
const leadGammaId = "33330000-3333-4333-8333-333333333333";

const projectAlphaId = "cccc0000-cccc-4ccc-8ccc-cccccccccccc";
const projectBetaId = "dddd0000-dddd-4ddd-8ddd-dddddddddddd";

function makeSection(
  overrides: Partial<ReportSectionReadModel> & {
    reportSectionId: string;
    reportId: string;
    authorId: string;
    authorName: string;
  },
): ReportSectionReadModel {
  return {
    version: 1,
    status: "submitted",
    submittedAt: new Date("2026-04-09T10:00:00.000Z"),
    authorRole: "lead",
    late: false,
    projects: [
      {
        projectId: projectAlphaId,
        projectName: "Project Alpha",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    ...overrides,
  };
}

const sourceAlpha: ReportSectionReadModel = makeSection({
  reportSectionId: "a1a10000-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  reportId: sourceReportId,
  authorId: leadAlphaId,
  authorName: "Lead Alpha",
  items: [
    {
      id: "e1e10000-e1e1-4e1e-8e1e-e1e1e1e1e1e1",
      projectId: projectAlphaId,
      type: "next",
      text: "Alpha next item — should carry",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
    },
    {
      id: "e2e20000-e2e2-4e2e-8e2e-e2e2e2e2e2e2",
      projectId: projectAlphaId,
      type: "current",
      text: "Alpha current item — should NOT carry",
      tag: "support",
      workflowStatus: "done",
      carriedOver: false,
      stageNames: ["Development"],
    },
    {
      id: "e3e30000-e3e3-4e3e-8e3e-e3e3e3e3e3e3",
      projectId: projectAlphaId,
      type: "next",
      text: "Alpha already-carried next — should NOT carry again",
      tag: "tech-debt",
      workflowStatus: "in_progress",
      carriedOver: true,
      stageNames: ["Development"],
    },
  ],
  decisions: [
    {
      id: "f1f10000-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
      text: "Unresolved decision alpha",
      owner: "Department Head",
      deadline: null,
      impact: "Needs escalation",
      resolvedAt: null,
      // Decision.productId is a NOT-NULL product FK — a carried decision needs
      // a product to persist (and thus to be counted).
      productId: projectAlphaId,
      stageNames: ["Development"],
    },
    {
      id: "f2f20000-f2f2-4f2f-8f2f-f2f2f2f2f2f2",
      text: "Resolved decision alpha",
      owner: "Department Head",
      deadline: new Date("2026-04-01T00:00:00.000Z"),
      impact: "Already handled",
      resolvedAt: new Date("2026-04-05T12:00:00.000Z"),
      stageNames: ["Development"],
    },
  ],
});

const sourceBeta: ReportSectionReadModel = makeSection({
  reportSectionId: "b1b10000-b1b1-4b1b-8b1b-b1b1b1b1b1b1",
  reportId: sourceReportId,
  authorId: leadBetaId,
  authorName: "Lead Beta",
  projects: [
    {
      projectId: projectBetaId,
      projectName: "Project Beta",
      trafficLight: "yellow",
      ownedStages: [],
      stageSet: [],
      ownerGroupId: null,
    },
  ],
  items: [
    {
      id: "e4e40000-e4e4-4e4e-8e4e-e4e4e4e4e4e4",
      projectId: projectBetaId,
      type: "next",
      text: "Beta next item — should carry",
      tag: "bugfix",
      workflowStatus: "planned",
      carriedOver: false,
      stageNames: ["Development"],
    },
  ],
  decisions: [
    {
      id: "f3f30000-f3f3-4f3f-8f3f-f3f3f3f3f3f3",
      text: "Unresolved decision beta",
      owner: "Lead Beta",
      deadline: new Date("2026-05-01T00:00:00.000Z"),
      impact: "Blocks deployment",
      resolvedAt: null,
      productId: projectBetaId,
      stageNames: ["Development"],
    },
  ],
});

const sourceGamma: ReportSectionReadModel = makeSection({
  reportSectionId: "c1c10000-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  reportId: sourceReportId,
  authorId: leadGammaId,
  authorName: "Lead Gamma",
  items: [
    {
      id: "e5e50000-e5e5-4e5e-8e5e-e5e5e5e5e5e5",
      projectId: projectAlphaId,
      type: "next",
      text: "Gamma next item — should carry",
      tag: "infra",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
    },
  ],
  decisions: [],
});

function createInMemoryRepository(opts: {
  sourceSections: ReportSectionReadModel[];
  targetSections: ReportSectionReadModel[];
  targetReportState?: TargetReportState;
}): CarryOverRepository {
  const executions = new Map<string, CarryOverExecution>();
  const targetReportState: TargetReportState = opts.targetReportState ?? {
    status: "draft",
    periodState: "open",
    periodStatus: "open",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: null,
    publishedById: null,
    reopenedAt: null,
  };

  return {
    findExecutionByDedupeKey(
      dedupeKey: string,
    ): Promise<CarryOverExecution | null> {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return Promise.resolve(structuredClone(execution));
        }
      }
      return Promise.resolve(null);
    },

    getSourceSections(): Promise<ReportSectionReadModel[]> {
      return Promise.resolve(
        opts.sourceSections.map((s) => structuredClone(s)),
      );
    },

    getTargetSections(): Promise<ReportSectionReadModel[]> {
      return Promise.resolve(
        opts.targetSections.map((s) => structuredClone(s)),
      );
    },

    findPreviousReportId(): Promise<string | null> {
      return Promise.resolve(null);
    },

    getTargetReportState(): Promise<TargetReportState | null> {
      return Promise.resolve({ ...targetReportState });
    },

    saveCarryOver(
      execution: CarryOverExecution,
      records: CarryOverRecord[],
      targetSections: ReportSectionReadModel[],
    ): Promise<CarryOverResult> {
      executions.set(execution.id, structuredClone(execution));
      return Promise.resolve({
        execution: structuredClone(execution),
        records: structuredClone(records),
        targetSection: structuredClone(expectDefined(targetSections[0])),
      });
    },
  };
}

function makeTargetSection(
  source: ReportSectionReadModel,
): ReportSectionReadModel {
  return makeSection({
    reportSectionId: crypto.randomUUID(),
    reportId: targetReportId,
    authorId: source.authorId,
    authorName: source.authorName,
    status: "draft",
    submittedAt: null,
    projects: structuredClone(source.projects),
    items: [],
    decisions: [],
  });
}

describe("CarryOverService — contract tests", () => {
  it("throws when source === target report", async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [makeTargetSection(sourceAlpha)],
    });
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, sourceReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, sourceReportId),
    ).rejects.toThrow(
      "Carry-over requires different source and target reports.",
    );
  });

  it("throws when no source sections", async () => {
    const repo = createInMemoryRepository({
      sourceSections: [],
      targetSections: [makeTargetSection(sourceAlpha)],
    });
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow("Carry-over requires both source and target sections.");
  });

  it("throws when no target sections", async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [],
    });
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow("Carry-over requires both source and target sections.");
  });

  it("carries `next` items as `current` with carriedOver=true", async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // sourceAlpha has 1 eligible next item (non-carried-over)
    const carriedItems = result.targetSection.items.filter(
      (i) => i.carriedOver,
    );
    expect(carriedItems).toHaveLength(1);
    expect(expectDefined(carriedItems[0]).text).toBe(
      "Alpha next item — should carry",
    );
    expect(expectDefined(carriedItems[0]).type).toBe("current");
    expect(expectDefined(carriedItems[0]).carriedOver).toBe(true);
  });

  it("does NOT carry `current` items", async () => {
    // sourceAlpha has a current item: "Alpha current item — should NOT carry"
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const currentTexts = result.targetSection.items.map((i) => i.text);
    expect(currentTexts).not.toContain("Alpha current item — should NOT carry");
  });

  it("does NOT carry already carried-over items", async () => {
    // sourceAlpha has a next item with carriedOver=true: should be skipped
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const texts = result.targetSection.items.map((i) => i.text);
    expect(texts).not.toContain(
      "Alpha already-carried next — should NOT carry again",
    );
    expect(result.targetSection.items).toHaveLength(1);
  });

  it("carries unresolved decisions (resolvedAt === null)", async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const carriedDecisions = result.targetSection.decisions;
    expect(carriedDecisions).toHaveLength(1);
    expect(expectDefined(carriedDecisions[0]).text).toBe(
      "Unresolved decision alpha",
    );
    expect(expectDefined(carriedDecisions[0]).resolvedAt).toBeNull();
  });

  it("does NOT carry resolved decisions", async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const decisionTexts = result.targetSection.decisions.map((d) => d.text);
    expect(decisionTexts).not.toContain("Resolved decision alpha");
  });

  it("deduplicates: returns existing execution on second call", async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const first = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );
    const second = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(second.execution.id).toBe(first.execution.id);
    expect(second.execution.dedupeKey).toBe(
      `${sourceReportId}:${targetReportId}`,
    );
    expect(second.records).toHaveLength(0);
    expect(first.records.length).toBeGreaterThan(0);
  });

  it("matches sections by authorId", async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [targetAlpha],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // Target section matched via authorId — items and decisions appear
    expect(result.targetSection.authorId).toBe(leadAlphaId);
    expect(result.targetSection.items.length).toBeGreaterThan(0);
    expect(result.targetSection.decisions.length).toBeGreaterThan(0);
  });

  it("handles multiple sections from different leads", async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const targetBeta = makeTargetSection(sourceBeta);
    const targetGamma = makeTargetSection(sourceGamma);

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha, sourceBeta, sourceGamma],
      targetSections: [targetAlpha, targetBeta, targetGamma],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // sourceAlpha: 1 next item + 1 unresolved decision = 2 records
    // sourceBeta: 1 next item + 1 unresolved decision = 2 records
    // sourceGamma: 1 next item + 0 decisions = 1 record → 5 total
    expect(result.records).toHaveLength(5);
    expect(result.execution.carriedItemCount).toBe(3);
    expect(result.execution.carriedDecisionCount).toBe(2);
    expect(result.execution.status).toBe("completed");
  });

  it("empty items/decisions = 0 carried counts", async () => {
    // Source section with only current items and only resolved decisions
    const sourceEmpty: ReportSectionReadModel = makeSection({
      reportSectionId: "d1d10000-d1d1-4d1d-8d1d-d1d1d1d1d1d1",
      reportId: sourceReportId,
      authorId: leadAlphaId,
      authorName: "Lead Alpha",
      items: [
        {
          id: "e6e60000-e6e6-4e6e-8e6e-e6e6e6e6e6e6",
          projectId: projectAlphaId,
          type: "current",
          text: "Only current item here",
          tag: "support",
          workflowStatus: "done",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
      decisions: [
        {
          id: "f4f40000-f4f4-4f4f-8f4f-f4f4f4f4f4f4",
          text: "Already resolved decision",
          owner: "Lead Alpha",
          deadline: null,
          impact: "Done",
          resolvedAt: new Date("2026-04-01T12:00:00.000Z"),
          stageNames: ["Development"],
        },
      ],
    });

    const target = makeTargetSection(sourceEmpty);
    const repo = createInMemoryRepository({
      sourceSections: [sourceEmpty],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.execution.carriedDecisionCount).toBe(0);
    expect(result.records).toHaveLength(0);
    expect(result.targetSection.items).toHaveLength(0);
    expect(result.targetSection.decisions).toHaveLength(0);
  });

  it("carry-over creates items in target section", async () => {
    const target = makeTargetSection(sourceAlpha);
    expect(target.items).toHaveLength(0);

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.targetSection.items.length).toBeGreaterThan(0);
  });

  it("carry-over marks items as carriedOver=true", async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    const carriedItems = result.targetSection.items.filter(
      (i) => i.carriedOver,
    );
    expect(carriedItems.length).toBeGreaterThan(0);
    expect(result.targetSection.items.every((i) => i.carriedOver)).toBe(true);
  });

  it("carry-over with source having no eligible items produces 0 items", async () => {
    // Source with only current items (no next items to carry)
    const sourceNoNext: ReportSectionReadModel = makeSection({
      reportSectionId: "x1x10000-x1x1-4x1x-8x1x-x1x1x1x1x1x1",
      reportId: sourceReportId,
      authorId: leadAlphaId,
      authorName: "Lead Alpha",
      items: [
        {
          id: "e7e70000-e7e7-4e7e-8e7e-e7e7e7e7e7e7",
          projectId: projectAlphaId,
          type: "current",
          text: "Current only",
          tag: "feature",
          workflowStatus: "done",
          carriedOver: false,
          stageNames: ["Development"],
        },
      ],
      decisions: [],
    });
    const target = makeTargetSection(sourceNoNext);
    const repo = createInMemoryRepository({
      sourceSections: [sourceNoNext],
      targetSections: [target],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.execution.carriedDecisionCount).toBe(0);
    expect(result.targetSection.items).toHaveLength(0);
  });

  it("sets carriedItemCount and carriedDecisionCount correctly", async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const targetBeta = makeTargetSection(sourceBeta);

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha, sourceBeta],
      targetSections: [targetAlpha, targetBeta],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // sourceAlpha: 1 eligible next item, 1 unresolved decision
    // sourceBeta:  1 eligible next item, 1 unresolved decision
    expect(result.execution.carriedItemCount).toBe(2);
    expect(result.execution.carriedDecisionCount).toBe(2);

    // Total records = 2 items + 2 decisions = 4
    expect(result.records).toHaveLength(4);

    // Verify record structure — each record has the right source/target report IDs
    for (const record of result.records) {
      expect(record.sourceReportId).toBe(sourceReportId);
      expect(record.targetReportId).toBe(targetReportId);
      expect(record.status).toBe("completed");
      expect(record.carriedAt).toBeInstanceOf(Date);
    }

    const itemRecords = result.records.filter((r) => r.sourceItemId !== null);
    expect(itemRecords).toHaveLength(2);
    for (const r of itemRecords) {
      expect(r.targetItemId).not.toBeNull();
      expect(r.sourceDecisionId).toBeNull();
      expect(r.targetDecisionId).toBeNull();
    }

    const decisionRecords = result.records.filter(
      (r) => r.sourceDecisionId !== null,
    );
    expect(decisionRecords).toHaveLength(2);
    for (const r of decisionRecords) {
      expect(r.targetDecisionId).not.toBeNull();
      expect(r.sourceItemId).toBeNull();
      expect(r.targetItemId).toBeNull();
    }
  });

  it("source lead with no matching target section does not inflate counts or emit dangling records", async () => {
    // sourceGamma's author has NO section in the target report, so its row
    // cannot be persisted and must not be counted or recorded.
    const targetAlpha = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha, sourceGamma],
      targetSections: [targetAlpha],
    });
    const service = new CarryOverService(repo, createNullLogger());

    const result = await service.executeCarryOver(
      sourceReportId,
      targetReportId,
    );

    // Only sourceAlpha matches: 1 item + 1 decision.
    expect(result.execution.carriedItemCount).toBe(1);
    expect(result.execution.carriedDecisionCount).toBe(1);
    expect(result.records).toHaveLength(2);
    // No record references sourceGamma's unmatched item.
    const gammaItemId = "e5e50000-e5e5-4e5e-8e5e-e5e5e5e5e5e5";
    expect(result.records.some((r) => r.sourceItemId === gammaItemId)).toBe(
      false,
    );
  });

  it("rejects carry-over into a published target report (no write)", async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [makeTargetSection(sourceAlpha)],
      targetReportState: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: new Date(),
        publishedById: null,
        reopenedAt: null,
      },
    });
    const saveSpy = vi.spyOn(repo, "saveCarryOver");
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("rejects carry-over into an archived target report (no write)", async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [makeTargetSection(sourceAlpha)],
      targetReportState: {
        status: "draft",
        periodState: "archived",
        periodStatus: "open",
        archived: true,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    });
    const saveSpy = vi.spyOn(repo, "saveCarryOver");
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("rejects carry-over when a matched target section is submitted (no write)", async () => {
    // makeSection defaults status to "submitted"; the period stays editable so
    // the guard reaches the section-status check.
    const submittedTarget = makeSection({
      reportSectionId: crypto.randomUUID(),
      reportId: targetReportId,
      authorId: leadAlphaId,
      authorName: "Lead Alpha",
      items: [],
      decisions: [],
    });
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [submittedTarget],
    });
    const saveSpy = vi.spyOn(repo, "saveCarryOver");
    const service = new CarryOverService(repo, createNullLogger());

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
