// The advanced writer must produce rows a lead can actually save: every authored
// item, risk and decision carries a stage its section author owns on that row's
// product (`demo-seed-datasets` → seeded stage ownership). The writers are
// captured at their Prisma boundary so the guarantee is proved without a
// database and without the simple dataset that `full`/`stress` merge in.

import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  validateStageOwnership,
} from "@customreport/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { SEED_STAGES } from "../support/seed-constants.js";
import { seedActiveSections } from "./seed-advanced.active-sections.js";
import { PRODUCT_MARKETING_PORTAL } from "./seed-advanced.anchors.js";
import { seedCrossAuthorOverlay } from "./seed-advanced.cross-author.js";
import { seedDecisions } from "./seed-advanced.decisions.js";
import { seedHistoryPeriods } from "./seed-advanced.history.js";
import { seedPublishedSections } from "./seed-advanced.published-sections.js";
import { seedRisks } from "./seed-advanced.risks.js";
import { seedStageAssignments } from "./seed-advanced.stage-assignments.js";

interface UpsertArgs<T> {
  readonly create: T;
}

function captureUpserts<T>(rows: T[]) {
  return {
    upsert({ create }: UpsertArgs<T>) {
      rows.push(create);
      return Promise.resolve(create);
    },
  };
}

// The assignment writer reads the table back to learn the effective ownership,
// so the fake exposes both reads: no pre-existing row, and the captured rows.
function captureAssignments(rows: Prisma.StageAssignmentCreateManyInput[]) {
  return {
    ...captureUpserts(rows),
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve(rows),
  };
}

function captureDemo() {
  const sections: Prisma.ReportSectionUncheckedCreateInput[] = [];
  const assignments: Prisma.StageAssignmentCreateManyInput[] = [];
  const items: Prisma.ItemUncheckedCreateInput[] = [];
  const risks: Prisma.RiskUncheckedCreateInput[] = [];
  const decisions: Prisma.DecisionUncheckedCreateInput[] = [];
  const noop = () => Promise.resolve(null);
  const noopMany = () => Promise.resolve({ count: 0 });
  // Capture the real phase writers at their Prisma boundary without a database.
  const prisma = {
    reportSection: captureUpserts(sections),
    stageAssignment: captureAssignments(assignments),
    item: {
      ...captureUpserts(items),
      update: noop,
      updateMany: noopMany,
    },
    risk: captureUpserts(risks),
    decision: captureUpserts(decisions),
    report: captureUpserts<Prisma.ReportUncheckedCreateInput>([]),
    projectStatus: captureUpserts<Prisma.ProjectStatusUncheckedCreateInput>([]),
    stageStatus: captureUpserts<Prisma.StageStatusUncheckedCreateInput>([]),
  } as unknown as PrismaClient;

  return {
    prisma,
    sections,
    assignments,
    items,
    risks,
    decisions,
  };
}

// Prisma types a `String[]` create field as array-or-set; the writers only use
// the array form.
const stageNamesOf = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string")
    : [];

const ownedProjects = (
  demo: ReturnType<typeof captureDemo>,
  authorId: string,
) => {
  const assignments = demo.assignments.filter((row) => row.userId === authorId);
  return [...new Set(assignments.map((row) => row.projectId))].map(
    (projectId) => ({
      projectId,
      projectName: projectId,
      trafficLight: null,
      ownedStages: assignments
        .filter((row) => row.projectId === projectId)
        .map((row) => {
          const stage = SEED_STAGES.find((entry) => entry.id === row.stageId);
          if (!stage) throw new Error(`Missing seeded stage ${row.stageId}`);
          return {
            stageId: row.stageId,
            stageName: stage.name,
            sortOrder: stage.sortOrder,
          };
        }),
    }),
  );
};

// The composed `full`/`stress` profiles run the simple dataset first over the
// same product ids. A pair that dataset already owns must keep its owner, and
// the advanced rows must adapt instead of referencing a stage they lost.
describe("advanced seed composition", () => {
  it("never re-points a stage another dataset owns", async () => {
    const foreignLead = "a0000000-0000-4000-8000-0000000000ff";
    const planning = SEED_STAGES.find((stage) => stage.name === "Planning");
    if (!planning) throw new Error("Missing Planning stage");
    const keys = new Set([`${PRODUCT_MARKETING_PORTAL}|${planning.id}`]);
    const taken: Prisma.StageAssignmentCreateManyInput[] = [
      {
        id: "foreign-assignment",
        userId: foreignLead,
        projectId: PRODUCT_MARKETING_PORTAL,
        stageId: planning.id,
      },
    ];
    const assignments: Prisma.StageAssignmentCreateManyInput[] = [];
    const items: Prisma.ItemUncheckedCreateInput[] = [];
    const skipped: string[] = [];
    const noop = () => Promise.resolve(null);
    const noopMany = () => Promise.resolve({ count: 0 });
    const prisma = {
      reportSection: captureUpserts<Prisma.ReportSectionUncheckedCreateInput>(
        [],
      ),
      stageAssignment: {
        upsert({
          create,
          where,
        }: {
          create: Prisma.StageAssignmentCreateManyInput;
          where: {
            stageId_projectId: { stageId: string; projectId: string };
          };
        }) {
          const key = `${where.stageId_projectId.projectId}|${where.stageId_projectId.stageId}`;
          // The writer skips a foreign-owned pair before upserting it, so this
          // call must never see a taken key.
          expect(keys.has(key)).toBe(false);
          assignments.push(create);
          return Promise.resolve(create);
        },
        findUnique({
          where,
        }: {
          where: { stageId_projectId: { stageId: string; projectId: string } };
        }) {
          const key = `${where.stageId_projectId.projectId}|${where.stageId_projectId.stageId}`;
          if (keys.has(key)) {
            skipped.push(key);
            return Promise.resolve({ userId: foreignLead });
          }
          return Promise.resolve(null);
        },
        findMany: () => Promise.resolve([...assignments, ...taken]),
      },
      item: { ...captureUpserts(items), update: noop, updateMany: noopMany },
      risk: captureUpserts<Prisma.RiskUncheckedCreateInput>([]),
      decision: captureUpserts<Prisma.DecisionUncheckedCreateInput>([]),
      report: captureUpserts<Prisma.ReportUncheckedCreateInput>([]),
      projectStatus: captureUpserts<Prisma.ProjectStatusUncheckedCreateInput>(
        [],
      ),
      stageStatus: captureUpserts<Prisma.StageStatusUncheckedCreateInput>([]),
    } as unknown as PrismaClient;

    const { ownership } = await seedStageAssignments(prisma);
    await seedActiveSections(prisma, ownership);

    expect(skipped).toEqual([...keys]);
    expect(ownership.get(`${foreignLead}|${PRODUCT_MARKETING_PORTAL}`)).toEqual(
      ["Planning"],
    );
    const marketingRows = items.filter(
      (row) => row.projectId === PRODUCT_MARKETING_PORTAL,
    );
    expect(marketingRows.length).toBeGreaterThan(0);
    for (const row of marketingRows) {
      expect(stageNamesOf(row.stageNames)).not.toContain("Planning");
    }
  });
});

describe("advanced authored stage ownership", () => {
  let demo: ReturnType<typeof captureDemo>;

  beforeAll(async () => {
    demo = captureDemo();
    const { ownership } = await seedStageAssignments(demo.prisma);
    await seedActiveSections(demo.prisma, ownership);
    await seedRisks(demo.prisma, ownership);
    await seedCrossAuthorOverlay(demo.prisma, ownership);
    await seedDecisions(demo.prisma, ownership);
    await seedPublishedSections(demo.prisma, ownership);
    await seedHistoryPeriods(demo.prisma, ownership);
  });

  it("writes every generation of sections and rows", () => {
    expect(demo.sections).toHaveLength(30);
    expect(demo.items.length).toBeGreaterThan(0);
    expect(demo.risks.length).toBeGreaterThan(0);
    expect(demo.decisions.length).toBeGreaterThan(0);
  });

  it("accepts the complete payload of every seeded section", () => {
    expect(demo.sections.length).toBeGreaterThan(0);
    for (const source of demo.sections) {
      const section = reportSectionReadModelSchema.parse({
        ...source,
        reportSectionId: source.id,
        authorName: source.authorId,
        version: 1,
        projects: ownedProjects(demo, source.authorId),
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
      expect(validateStageOwnership(section, input)).toEqual([]);
    }
  });

  it("grants exactly the planned assignment set and nothing more", () => {
    // 12 products x 3 consecutive stages plus the 6 hand-written cross-author
    // rows. Granting an extra assignment to make an invalid row pass the guard
    // would change this count.
    expect(demo.assignments).toHaveLength(42);
    const keys = demo.assignments.map(
      (row) => `${row.projectId}|${row.stageId}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives the populated draft a stage its author owns on each row", () => {
    const draft = demo.sections.find(
      (row) => row.authorId === "a0000000-0000-4000-8000-000000000015",
    );
    expect(draft).toBeDefined();
    const rows = demo.items.filter((row) => row.reportSectionId === draft?.id);
    expect(rows.length).toBeGreaterThan(0);
    const owned = new Set(
      ownedProjects(demo, "a0000000-0000-4000-8000-000000000015").flatMap(
        (project) => project.ownedStages.map((stage) => stage.stageName),
      ),
    );
    for (const row of rows) {
      const stageNames = stageNamesOf(row.stageNames);
      expect(stageNames.length).toBeGreaterThan(0);
      for (const stageName of stageNames) {
        expect(owned).toContain(stageName);
      }
    }
  });
});
