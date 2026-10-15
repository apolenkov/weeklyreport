import type { Prisma, PrismaClient } from "@prisma/client";
import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  validateStageOwnership,
} from "@weeklyreport/shared";
import { beforeAll, describe, expect, it } from "vitest";

import { seedCrossAuthorOverlay } from "./seed-simple.cross-author-overlay.js";
import {
  LEAD_1,
  LEAD_MOBILE_PM,
  PROD_CRM,
  PROD_MOBILE,
} from "./seed-simple.ids.js";
import { LEADS } from "./seed-simple.leads.js";
import { seedActiveSections } from "./seed-simple.sections.js";
import { seedStageAssignments, seedStages } from "./seed-simple.stages.js";

function captureWrites<T>(rows: T[]) {
  return {
    create({ data }: { data: T }) {
      rows.push(data);
      return Promise.resolve(data);
    },
    createMany({ data }: { data: T[] }) {
      rows.push(...data);
      return Promise.resolve({ count: data.length });
    },
  };
}

async function captureDemo() {
  const sections: Prisma.ReportSectionUncheckedCreateInput[] = [];
  const stages: Prisma.StageCreateManyInput[] = [];
  const assignments: Prisma.StageAssignmentCreateManyInput[] = [];
  const stageStatuses: Prisma.StageStatusCreateManyInput[] = [];
  const items: Prisma.ItemCreateManyInput[] = [];
  const risks: Prisma.RiskCreateManyInput[] = [];
  const decisions: Prisma.DecisionCreateManyInput[] = [];
  // Capture the real phase writers at their Prisma boundary without a database.
  const prisma = {
    reportSection: captureWrites(sections),
    stage: captureWrites(stages),
    stageAssignment: captureWrites(assignments),
    stageStatus: captureWrites(stageStatuses),
    projectStatus: captureWrites<Prisma.ProjectStatusCreateManyInput>([]),
    item: captureWrites(items),
    risk: captureWrites(risks),
    decision: captureWrites(decisions),
  } as unknown as PrismaClient;
  await seedStages(prisma);
  await seedStageAssignments(prisma);
  await seedActiveSections(prisma);
  const baseRecordCount = items.length + risks.length + decisions.length;
  await seedCrossAuthorOverlay(prisma);
  return {
    sections,
    stages,
    assignments,
    stageStatuses,
    items,
    risks,
    decisions,
    overlayRecordCount:
      items.length + risks.length + decisions.length - baseRecordCount,
  };
}

describe("demo record stage ownership", () => {
  let demo: Awaited<ReturnType<typeof captureDemo>>;
  beforeAll(async () => {
    demo = await captureDemo();
  });

  it.each(LEADS)("accepts all base and overlay rows for $name", (lead) => {
    const source = demo.sections.find(
      (section) => section.authorId === lead.id,
    );
    expect(source).toBeDefined();
    if (!source) throw new Error(`Missing demo section for ${lead.id}`);
    const assignments = demo.assignments.filter(
      (row) => row.userId === lead.id,
    );
    const projects = [...new Set(assignments.map((row) => row.projectId))].map(
      (projectId) => ({
        projectId,
        projectName: projectId,
        trafficLight: null,
        ownedStages: assignments
          .filter((row) => row.projectId === projectId)
          .map((row) => {
            const stage = demo.stages.find((entry) => entry.id === row.stageId);
            if (!stage) throw new Error(`Missing seeded stage ${row.stageId}`);
            return {
              stageId: row.stageId,
              stageName: stage.name,
              sortOrder: stage.sortOrder,
            };
          }),
      }),
    );
    const section = reportSectionReadModelSchema.parse({
      ...source,
      reportSectionId: source.id,
      authorName: lead.name,
      authorRole: "lead",
      version: 1,
      projects,
      items: demo.items.filter((row) => row.reportSectionId === source.id),
      risks: demo.risks.filter((row) => row.reportSectionId === source.id),
      decisions: demo.decisions.filter(
        (row) => row.reportSectionId === source.id,
      ),
    });
    const input = draftSaveSchema.parse({
      reportSectionId: section.reportSectionId,
      version: section.version,
      projectStatuses: [],
      items: section.items,
      risks: section.risks,
      decisions: section.decisions,
    });
    expect(input.items.length).toBeGreaterThan(0);
    // Empty stored rows validate every seeded row as new.
    expect(
      validateStageOwnership(
        { ...section, items: [], risks: [], decisions: [] },
        input,
      ),
    ).toEqual([]);
    const statuses = demo.stageStatuses.filter(
      (row) => row.reportSectionId === source.id,
    );
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(
        assignments.some(
          (row) =>
            row.projectId === status.projectId &&
            row.stageId === status.stageId,
        ),
      ).toBe(true);
    }
  });

  it("includes a current CRM item spanning every stage owned by its author", () => {
    const section = demo.sections.find((row) => row.authorId === LEAD_1);
    const item = demo.items.find(
      (row) =>
        row.reportSectionId === section?.id &&
        row.id === "a0000000-0000-4000-8000-000000051001",
    );

    expect(item).toMatchObject({
      type: "current",
      projectId: PROD_CRM,
      stageNames: ["Development", "Testing", "DevOps", "Support"],
    });
    const stageNames = item?.stageNames;
    if (
      !Array.isArray(stageNames) ||
      !stageNames.every(
        (stageName): stageName is string => typeof stageName === "string",
      )
    ) {
      throw new Error("Expected the multi-stage demo item to use stage names.");
    }
    for (const stageName of stageNames) {
      const stage = demo.stages.find((row) => row.name === stageName);
      expect(
        demo.assignments.some(
          (row) =>
            row.userId === LEAD_1 &&
            row.projectId === PROD_CRM &&
            row.stageId === stage?.id,
        ),
      ).toBe(true);
    }
  });

  it("checks nine sections and all sixteen overlay records including Mobile dependencies", () => {
    expect(demo.sections).toHaveLength(9);
    expect(demo.overlayRecordCount).toBe(16);
    const section = demo.sections.find(
      (row) => row.authorId === LEAD_MOBILE_PM,
    );
    expect(section?.status).toBe("draft");
    expect(
      demo.risks.find(
        (row) => row.id === "a0000000-0000-4000-8000-000000009003",
      ),
    ).toMatchObject({
      reportSectionId: section?.id,
      projectId: PROD_MOBILE,
      stageNames: ["Planning"],
    });
    expect(
      demo.decisions.find(
        (row) => row.id === "a0000000-0000-4000-8000-000000007005",
      ),
    ).toMatchObject({
      reportSectionId: section?.id,
      productId: PROD_MOBILE,
      stageNames: ["Planning"],
    });
  });
});
