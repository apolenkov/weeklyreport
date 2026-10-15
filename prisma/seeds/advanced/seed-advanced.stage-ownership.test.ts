// The advanced writer must produce rows a lead can actually save: every authored
// item, risk and decision carries a stage its section author owns on that row's
// product (`demo-seed-datasets` → seeded stage ownership). The writers are
// captured at their Prisma boundary so the guarantee is proved without a
// database and without the simple dataset that `full`/`stress` merge in.

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  draftSaveSchema,
  itemOutcomeStateSchema,
  reportSectionReadModelSchema,
  validateStageOwnership,
} from "@weeklyreport/shared";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { seedActiveSections as seedSimpleSections } from "../simple/seed-simple.sections.js";
import { seedStageAssignments as seedSimpleAssignments } from "../simple/seed-simple.stages.js";
import { LEAD_1_ID, SEED_STAGES } from "../support/seed-constants.js";
import { seedActiveSections } from "./seed-advanced.active-sections.js";
import { PRODUCT_MARKETING_PORTAL } from "./seed-advanced.anchors.js";
import { seedCrossAuthorOverlay } from "./seed-advanced.cross-author.js";
import { seedDecisions } from "./seed-advanced.decisions.js";
import { seedHistoryPeriods } from "./seed-advanced.history.js";
import { seedPublishedSections } from "./seed-advanced.published-sections.js";
import { seedRisks } from "./seed-advanced.risks.js";
import { seedStageAssignments } from "./seed-advanced.stage-assignments.js";
import {
  ownedStageName,
  ownedStageNameAt,
  ownedStageNames,
  ownershipKey,
  type StageOwnership,
} from "./seed-advanced.stage-names.js";

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
    stageStatus: {
      ...captureUpserts<Prisma.StageStatusUncheckedCreateInput>([]),
      deleteMany: noopMany,
    },
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

type StoredRow = Record<string, unknown>;

const isRow = (value: unknown): value is StoredRow =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Only ordinary delegates and the declared FK ON UPDATE CASCADE are modeled.
// Ownership and cleanup predicates come exclusively from the real writers.
function composedStore() {
  const tables = {
    reportSection: new Map<string, StoredRow>(),
    stageAssignment: new Map<string, StoredRow>(),
    projectStatus: new Map<string, StoredRow>(),
    stageStatus: new Map<string, StoredRow>(),
    item: new Map<string, StoredRow>(),
    risk: new Map<string, StoredRow>(),
    decision: new Map<string, StoredRow>(),
  };
  const stageWrites: StoredRow[] = [];
  const matches = (row: StoredRow, where: StoredRow): boolean =>
    Object.entries(where).every(([field, value]) => {
      if (field === "OR")
        return (
          Array.isArray(value) &&
          value.some((clause: unknown) => isRow(clause) && matches(row, clause))
        );
      if (isRow(value) && "not" in value) return row[field] !== value.not;
      return row[field] === value;
    });
  const cascadeSection = (previousId: unknown, nextId: unknown) => {
    for (const table of [
      tables.stageStatus,
      tables.projectStatus,
      tables.item,
      tables.risk,
      tables.decision,
    ]) {
      for (const [id, row] of [...table].filter(
        ([, entry]) => entry.reportSectionId === previousId,
      )) {
        table.set(id, { ...row, reportSectionId: nextId });
      }
    }
  };
  const delegate = (name: keyof typeof tables) => {
    const rows = tables[name];
    const put = (row: StoredRow) => {
      rows.set(String(row.id), row);
      return row;
    };
    return {
      create: ({ data }: { data: StoredRow }) => Promise.resolve(put(data)),
      createMany: ({ data }: { data: readonly StoredRow[] }) => {
        for (const row of data) put(row);
        return Promise.resolve({ count: data.length });
      },
      findUnique: ({ where }: { where: StoredRow }) => {
        const natural = Object.values(where)[0];
        const selector = isRow(natural) ? natural : where;
        return Promise.resolve(
          [...rows.values()].find((row) => matches(row, selector)) ?? null,
        );
      },
      findMany: () => Promise.resolve([...rows.values()]),
      upsert: ({
        where,
        create,
        update,
      }: {
        where: StoredRow;
        create: StoredRow;
        update: StoredRow;
      }) => {
        const natural = Object.values(where)[0];
        const selector = isRow(natural) ? natural : where;
        const existing = [...rows.values()].find((row) =>
          matches(row, selector),
        );
        const supplied = Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined),
        );
        const persisted = existing ? { ...existing, ...supplied } : create;
        if (existing && existing.id !== persisted.id) {
          rows.delete(String(existing.id));
          if (name === "reportSection") {
            cascadeSection(existing.id, persisted.id);
          }
        }
        put(persisted);
        if (name === "stageStatus") stageWrites.push(persisted);
        return Promise.resolve(persisted);
      },
      update: ({ where, data }: { where: StoredRow; data: StoredRow }) => {
        const existing = [...rows.values()].find((row) => matches(row, where));
        return Promise.resolve(existing ? put({ ...existing, ...data }) : null);
      },
      updateMany: ({ where, data }: { where: StoredRow; data: StoredRow }) => {
        const selected = [...rows.values()].filter((row) =>
          matches(row, where),
        );
        for (const row of selected) put({ ...row, ...data });
        return Promise.resolve({ count: selected.length });
      },
      deleteMany: ({ where }: { where: StoredRow }) => {
        const selected = [...rows.values()].filter((row) =>
          matches(row, where),
        );
        for (const row of selected) rows.delete(String(row.id));
        return Promise.resolve({ count: selected.length });
      },
    };
  };
  const prisma = Object.fromEntries(
    Object.keys(tables).map((name) => [
      name,
      delegate(name as keyof typeof tables),
    ]),
  ) as unknown as PrismaClient;
  return { tables, stageWrites, prisma };
}

const foreignStatuses = (store: ReturnType<typeof composedStore>) =>
  [...store.tables.stageStatus.values()].filter((status) => {
    const section = store.tables.reportSection.get(
      String(status.reportSectionId),
    );
    return ![...store.tables.stageAssignment.values()].some(
      (assignment) =>
        assignment.projectId === status.projectId &&
        assignment.stageId === status.stageId &&
        assignment.userId === section?.authorId,
    );
  });

// The composed `full`/`stress` profiles run the simple dataset first over the
// same product ids. A pair that dataset already owns must keep its owner, and
// the advanced rows must adapt instead of referencing a stage they lost.
describe("advanced seed composition", () => {
  it("keeps real simple-to-advanced statuses owned after section rekey", async () => {
    const store = composedStore();
    await seedSimpleAssignments(store.prisma);
    await seedSimpleSections(store.prisma);
    const primary = [...store.tables.reportSection.values()].find(
      (row) => row.authorId === LEAD_1_ID,
    );
    const originalSectionId = primary?.id;
    const originalStatuses = [...store.tables.stageStatus.values()].filter(
      (row) => row.reportSectionId === originalSectionId,
    );
    expect(originalStatuses.length).toBeGreaterThan(0);
    const { ownership } = await seedStageAssignments(store.prisma);
    const counts = await seedActiveSections(store.prisma, ownership);

    expect(foreignStatuses(store)).toEqual([]);
    const restored = [...store.tables.reportSection.values()].find(
      (row) => row.authorId === LEAD_1_ID,
    );
    expect(restored?.id).not.toBe(originalSectionId);
    for (const original of originalStatuses) {
      expect(store.tables.stageStatus.get(String(original.id))).toMatchObject({
        ...original,
        reportSectionId: restored?.id,
      });
    }
    expect(counts.stageStatuses).toBe(store.stageWrites.length);
  });

  it("restores only exact unowned generated slots and keeps all other status identities", async () => {
    const store = composedStore();
    await seedSimpleAssignments(store.prisma);
    await seedSimpleSections(store.prisma);
    const { ownership } = await seedStageAssignments(store.prisma);
    await seedActiveSections(store.prisma, ownership);
    const primary = [...store.tables.reportSection.values()].find(
      (row) => row.authorId === LEAD_1_ID,
    );
    const identity = {
      reportSectionId: primary?.id,
      projectId: PRODUCT_MARKETING_PORTAL,
    };
    const invalid = {
      ...identity,
      id: "a0000000-0000-4000-8000-f00100010001",
      stageId: "a0000000-0000-4000-8000-000000000701",
      status: "red",
    };
    const differentStage = {
      ...identity,
      id: "a0000000-0000-4000-8000-f00100010002",
      stageId: "a0000000-0000-4000-8000-000000000707",
      status: "green",
    };
    const otherSection = {
      ...identity,
      id: "a0000000-0000-4000-8000-f00100010003",
      stageId: "a0000000-0000-4000-8000-000000000703",
      reportSectionId: "a0000000-0000-4000-8000-00000000eff3",
      status: "yellow",
    };
    for (const row of [invalid, differentStage, otherSection])
      store.tables.stageStatus.set(row.id, row);
    const validGenerated = store.tables.stageStatus.get(
      "a0000000-0000-4000-8000-f00100020001",
    );
    const validNongenerated = [...store.tables.stageStatus.values()].find(
      (row) =>
        row.reportSectionId === primary?.id &&
        row.projectId === PRODUCT_MARKETING_PORTAL &&
        row.stageId === "a0000000-0000-4000-8000-000000000704",
    );
    expect(validGenerated).toBeDefined();
    expect(validNongenerated).toBeDefined();
    const writesBefore = store.stageWrites.length;

    const counts = await seedActiveSections(store.prisma, ownership);

    expect(store.tables.stageStatus.has(invalid.id)).toBe(false);
    for (const row of [
      differentStage,
      otherSection,
      validGenerated,
      validNongenerated,
    ]) {
      expect(store.tables.stageStatus.get(String(row?.id))).toEqual(row);
    }
    expect(counts.stageStatuses).toBe(store.stageWrites.length - writesBefore);
    const after = [...store.tables.stageStatus.entries()];
    expect(await seedActiveSections(store.prisma, ownership)).toEqual(counts);
    expect([...store.tables.stageStatus.entries()]).toEqual(after);
  });

  it("rejects missing or unknown effective ownership before status cleanup", async () => {
    const store = composedStore();
    const remove = vi.spyOn(store.prisma.stageStatus, "deleteMany");
    await expect(seedActiveSections(store.prisma, new Map())).rejects.toThrow(
      "owns no stage",
    );
    expect(remove).not.toHaveBeenCalled();
    await expect(
      seedActiveSections(
        store.prisma,
        new Map([
          [
            ownershipKey(LEAD_1_ID, PRODUCT_MARKETING_PORTAL),
            ["Unknown stage"],
          ],
        ]),
      ),
    ).rejects.toThrow("unknown owned stages");
    expect(remove).not.toHaveBeenCalled();
  });

  it("preserves the first owner inserted between absent read and upsert", async () => {
    const target = {
      projectId: PRODUCT_MARKETING_PORTAL,
      stageId: "a0000000-0000-4000-8000-000000000701",
    };
    const foreign = {
      ...target,
      id: "a0000000-0000-4000-8000-00000000eff1",
      userId: "a0000000-0000-4000-8000-0000000000ff",
    };
    type Assignment = typeof foreign;
    const key = (pair: typeof target): string =>
      `${pair.projectId}|${pair.stageId}`;
    const records = new Map<string, Assignment>();
    const inserted = new Set<string>();
    const prisma = {
      stageAssignment: {
        findUnique: ({
          where,
        }: {
          where: { stageId_projectId: typeof target };
        }) => {
          const pair = where.stageId_projectId;
          const found = records.get(key(pair));
          if (!found && key(pair) === key(target) && !inserted.has(key(pair))) {
            records.set(key(pair), foreign);
            inserted.add(key(pair));
            return Promise.resolve(null);
          }
          return Promise.resolve(found ?? null);
        },
        upsert: ({
          where,
          create,
          update,
        }: {
          where: { stageId_projectId: typeof target };
          create: Assignment;
          update: Partial<Assignment>;
        }) => {
          const pair = key(where.stageId_projectId);
          const existing = records.get(pair);
          const persisted = existing ? { ...existing, ...update } : create;
          records.set(pair, persisted);
          return Promise.resolve(persisted);
        },
        findMany: () => Promise.resolve([...records.values()]),
      },
    } as unknown as PrismaClient;

    const { ownership } = await seedStageAssignments(prisma);

    expect(inserted.size).toBe(1);
    expect(records.get(key(target))).toEqual(foreign);
    expect(
      ownership.get(ownershipKey(foreign.userId, target.projectId)),
    ).toEqual(["Planning"]);
    expect(
      ownership.get(ownershipKey(LEAD_1_ID, target.projectId)),
    ).not.toContain("Planning");
    expect(records.size).toBeGreaterThan(1);
  });

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
      stageStatus: {
        ...captureUpserts<Prisma.StageStatusUncheckedCreateInput>([]),
        deleteMany: noopMany,
      },
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

  it("fails closed when the effective map loses every stage for a pair", async () => {
    const foreignLead = "a0000000-0000-4000-8000-0000000000fe";
    // Static rows grant the primary lead Planning/Analysis/Design on
    // Marketing, but the effective map hands every stage there to a foreign
    // owner, so the pair's key is absent. The map must win: no fallback.
    const ownership: StageOwnership = new Map([
      [
        ownershipKey(foreignLead, PRODUCT_MARKETING_PORTAL),
        SEED_STAGES.map((stage) => stage.name),
      ],
    ]);
    const failClosed = /owns no stage/;
    expect(() =>
      ownedStageNames(LEAD_1_ID, PRODUCT_MARKETING_PORTAL, ownership),
    ).toThrow(failClosed);
    expect(() =>
      ownedStageNameAt(LEAD_1_ID, PRODUCT_MARKETING_PORTAL, 0, ownership),
    ).toThrow(failClosed);
    expect(() =>
      ownedStageName(
        LEAD_1_ID,
        PRODUCT_MARKETING_PORTAL,
        "Planning",
        ownership,
      ),
    ).toThrow(failClosed);

    // The writer must refuse instead of selecting an unowned stage: the first
    // section's first item targets (primary, Marketing).
    const items: Prisma.ItemUncheckedCreateInput[] = [];
    const noop = () => Promise.resolve(null);
    const noopMany = () => Promise.resolve({ count: 0 });
    const prisma = {
      reportSection: captureUpserts<Prisma.ReportSectionUncheckedCreateInput>(
        [],
      ),
      projectStatus: captureUpserts<Prisma.ProjectStatusUncheckedCreateInput>(
        [],
      ),
      stageStatus: {
        ...captureUpserts<Prisma.StageStatusUncheckedCreateInput>([]),
        deleteMany: noopMany,
      },
      item: { ...captureUpserts(items), update: noop, updateMany: noopMany },
    } as unknown as PrismaClient;
    await expect(seedActiveSections(prisma, ownership)).rejects.toThrow(
      failClosed,
    );
    expect(items).toHaveLength(0);
  });

  it("keeps the static rows only for callers without a map", () => {
    expect(ownedStageNames(LEAD_1_ID, PRODUCT_MARKETING_PORTAL)).toEqual([
      "Planning",
      "Analysis",
      "Design",
    ]);
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
        authorRole: "lead",
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
      // Empty stored rows validate every seeded row as new.
      expect(
        validateStageOwnership(
          { ...section, items: [], risks: [], decisions: [] },
          input,
        ),
      ).toEqual([]);
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

it("restores an actually paused stored item through the active-section producer", async () => {
  const storage = composedStore();
  const { ownership } = await seedStageAssignments(storage.prisma);
  await seedActiveSections(storage.prisma, ownership);
  const item = [...storage.tables.item.values()].find(
    (entry) =>
      entry.type === "current" && entry.workflowStatus === "in_progress",
  );
  if (!item) throw new Error("Expected current deterministic item");
  const paused = {
    ...item,
    workflowStatus: "paused",
    pausedReason: "Synthetic admitted pause",
    nextStepText: null,
  };
  expect(
    itemOutcomeStateSchema.safeParse({
      type: item.type,
      workflowStatus: paused.workflowStatus,
      pausedReason: paused.pausedReason,
      nextStepText: paused.nextStepText,
    }).success,
  ).toBe(true);
  storage.tables.item.set(String(item.id), paused);
  await seedActiveSections(storage.prisma, ownership);
  const restored = storage.tables.item.get(String(item.id));
  expect(restored).toMatchObject({
    id: item.id,
    stableId: item.stableId,
    workflowStatus: "in_progress",
    pausedReason: null,
  });
  expect(
    itemOutcomeStateSchema.safeParse({
      type: restored?.type,
      workflowStatus: restored?.workflowStatus,
      pausedReason: restored?.pausedReason,
      nextStepText: null,
    }).success,
  ).toBe(true);
});

it("keeps Olga's Testing and DevOps evidence without emitting explicit status overrides", async () => {
  const storage = composedStore();
  const { ownership } = await seedStageAssignments(storage.prisma);
  await seedActiveSections(storage.prisma, ownership);
  await seedRisks(storage.prisma, ownership);
  const olga = "a0000000-0000-4000-8000-000000000015";
  const payment = "a0000000-0000-4000-8000-000000000209";
  const section = [...storage.tables.reportSection.values()].find(
    (entry) => entry.authorId === olga,
  );
  expect(section).toBeDefined();
  for (const [name, severity] of [
    ["Testing", "at-risk"],
    ["DevOps", "blocked"],
  ]) {
    const stage = SEED_STAGES.find((entry) => entry.name === name);
    expect(ownership.get(ownershipKey(olga, payment))).toContain(name);
    expect(
      [...storage.tables.stageStatus.values()].filter(
        (entry) =>
          entry.reportSectionId === section?.id &&
          entry.projectId === payment &&
          entry.stageId === stage?.id,
      ),
    ).toEqual([]);
    expect(
      [...storage.tables.risk.values()].some(
        (entry) =>
          entry.reportSectionId === section?.id &&
          entry.projectId === payment &&
          stageNamesOf(entry.stageNames).includes(String(name)) &&
          entry.severity === severity,
      ),
    ).toBe(true);
  }
});
