import type {
  CarryOverExecution,
  CarryOverRecord,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { carryOverRouter } from "./carry-over.router";
import {
  CarryOverDomainError,
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
  status: "submitted",
  submittedAt: new Date("2026-04-09T10:00:00.000Z"),
  projects: [
    {
      projectId: "44444444-4444-4444-8444-444444444444",
      projectName: "Project 1",
      trafficLight: "yellow",
    },
  ],
  items: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "next",
      text: "Move this into next period",
      tag: "feature",
      workflowStatus: "in_progress",
      carriedOver: false,
    },
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      projectId: "44444444-4444-4444-8444-444444444444",
      type: "current",
      text: "Do not carry this one",
      tag: "support",
      workflowStatus: "done",
      carriedOver: false,
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
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      text: "Resolved decision",
      owner: "Department Head",
      deadline: null,
      impact: "Already done",
      resolvedAt: new Date("2026-04-08T12:00:00.000Z"),
    },
  ],
};

function createRepository(
  section: ReportSectionReadModel,
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
  };
  let records: CarryOverRecord[] = [];

  return {
    async findExecutionByDedupeKey(dedupeKey: string) {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return structuredClone(execution);
        }
      }
      return null;
    },
    async getSourceSections() {
      return [structuredClone(section)];
    },
    async getTargetSections() {
      return [structuredClone(targetSection)];
    },
    async saveCarryOver(
      execution: CarryOverExecution,
      nextRecords: CarryOverRecord[],
      nextSection: ReportSectionReadModel,
    ) {
      executions.set(execution.id, structuredClone(execution));
      records = structuredClone(nextRecords);
      targetSection = structuredClone(nextSection);
      return {
        execution: structuredClone(execution),
        records: structuredClone(records),
        targetSection: structuredClone(targetSection),
      };
    },
  };
}

describe("CarryOverService", () => {
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
          workflowStatus: "blocked",
          carriedOver: false,
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
        async findExecutionByDedupeKey(dedupeKey: string) {
          for (const execution of executions.values()) {
            if (execution.dedupeKey === dedupeKey) {
              return structuredClone(execution);
            }
          }
          return null;
        },
        async getSourceSections() {
          return sources.map((s) => structuredClone(s));
        },
        async getTargetSections() {
          return targetSections.map((s) => structuredClone(s));
        },
        async saveCarryOver(
          execution: CarryOverExecution,
          nextRecords: CarryOverRecord[],
          nextSection: ReportSectionReadModel,
        ) {
          executions.set(execution.id, structuredClone(execution));
          savedRecords = structuredClone(nextRecords);
          return {
            execution: structuredClone(execution),
            records: structuredClone(savedRecords),
            targetSection: structuredClone(nextSection),
          };
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

      // sourceSection has 1 next item + 1 unresolved decision = 2 records
      // secondSourceSection has 1 next item = 1 record
      // thirdSourceSection has 1 next item = 1 record
      // Total: 4 records
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
      const repo: CarryOverRepository = {
        async findExecutionByDedupeKey() {
          return null;
        },
        async getSourceSections() {
          return [];
        },
        async getTargetSections() {
          return [structuredClone(sourceSection)];
        },
        async saveCarryOver(execution, records, section) {
          return { execution, records, targetSection: section };
        },
      };

      const service = new CarryOverService(repo);

      await expect(
        service.executeCarryOver(sourceReportId, targetReportId),
      ).rejects.toBeInstanceOf(CarryOverDomainError);
    });

    it("throws when target sections are empty", async () => {
      const repo: CarryOverRepository = {
        async findExecutionByDedupeKey() {
          return null;
        },
        async getSourceSections() {
          return [structuredClone(sourceSection)];
        },
        async getTargetSections() {
          return [];
        },
        async saveCarryOver(execution, records, section) {
          return { execution, records, targetSection: section };
        },
      };

      const service = new CarryOverService(repo);

      await expect(
        service.executeCarryOver(sourceReportId, targetReportId),
      ).rejects.toBeInstanceOf(CarryOverDomainError);
    });
  });
});

describe("carryOverRouter", () => {
  it("returns the carry-over execution result", async () => {
    const service = new CarryOverService(createRepository(sourceSection));

    await expect(
      carryOverRouter.executeCarryOver({
        carryOverService: service,
        sourceReportId,
        targetReportId,
      }),
    ).resolves.toMatchObject({
      execution: { status: "completed" },
    });
  });
});
