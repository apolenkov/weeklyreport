// fix-lead-surface-name-resolution: pins the name-only `referencedProjects`
// emission of mapPrismaToReportSection — rows (items / risks / decisions)
// referencing a project the section author owns no stage on contribute the
// project's name so the lead-surface mappers never show "Unknown"/"Group"
// for a product the system can name.
import { describe, expect, it, vi } from "vitest";

import {
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
  ReportSectionsPrismaRepository,
} from "./report-sections.prisma-repository";
import { SectionVersionConflictError } from "./report-sections.service";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const OWNED_PROJECT = "44444444-4444-4444-8444-444444444444";
const UNOWNED_PROJECT = "55555555-5555-4555-8555-555555555555";
const STAGE_ID = "66666666-6666-4666-8666-666666666666";
const TESTING_STAGE_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

type FabricatedRow = Pick<
  PrismaReportSectionWithRelations,
  | "author"
  | "projectStatuses"
  | "stageStatuses"
  | "items"
  | "risks"
  | "decisions"
> & {
  id: string;
  reportId: string;
  authorId: string;
  status: string;
  submittedAt: Date | null;
  late: boolean;
  version: number;
};

function baseRow(overrides: Partial<FabricatedRow> = {}): FabricatedRow {
  return {
    id: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    status: "draft",
    submittedAt: null,
    late: false,
    version: 1,
    author: {
      name: "Lead 1",
      role: "lead",
      id: AUTHOR_ID,
      stageAssignments: [
        {
          userId: AUTHOR_ID,
          stageId: STAGE_ID,
          projectId: OWNED_PROJECT,
          project: {
            id: OWNED_PROJECT,
            name: "Owned Project",
            archived: false,
          },
          stage: { id: STAGE_ID, name: "Development", sortOrder: 4 },
        },
      ],
    },
    projectStatuses: [],
    stageStatuses: [],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

function mapRow(row: FabricatedRow) {
  return mapPrismaToReportSection(
    row as unknown as PrismaReportSectionWithRelations,
  );
}

function fabricatedRisk(
  projectId: string,
  project: { name: string } | undefined,
) {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    projectId,
    risk: "Cross-stage risk",
    impact: "Impact",
    mitigation: "Mitigation",
    severity: "at-risk",
    stageNames: [],
    project,
  };
}

describe("mapPrismaToReportSection — referencedProjects", () => {
  it("emits a name-only entry for a project a risk references but the author owns no stage on", () => {
    const section = mapRow(
      baseRow({
        risks: [fabricatedRisk(UNOWNED_PROJECT, { name: "Foreign Project" })],
      }),
    );

    expect(section.referencedProjects).toEqual([
      { projectId: UNOWNED_PROJECT, projectName: "Foreign Project" },
    ]);
    // Name-only: the stage-owned `projects` array is NOT widened, so no
    // stray product card / ProjectStatus write / submit demand appears.
    expect(section.projects.map((p) => p.projectId)).toEqual([OWNED_PROJECT]);
  });

  it("collects names from items and decisions too", () => {
    const section = mapRow(
      baseRow({
        items: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            projectId: UNOWNED_PROJECT,
            type: "current",
            text: "Cross-stage item",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: false,
            completed: null,
            priorityRank: null,
            stageNames: [],
            project: { name: "Foreign Project" },
          },
        ],
        decisions: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            text: "Cross-stage decision",
            owner: "Owner",
            deadline: null,
            impact: "Impact",
            resolvedAt: null,
            stageNames: [],
            productId: UNOWNED_PROJECT,
            project: { name: "Foreign Project" },
          },
        ],
      }),
    );

    expect(section.referencedProjects).toEqual([
      { projectId: UNOWNED_PROJECT, projectName: "Foreign Project" },
    ]);
  });

  it("excludes stage-owned projects — they already carry their name in `projects`", () => {
    const section = mapRow(
      baseRow({
        risks: [fabricatedRisk(OWNED_PROJECT, { name: "Owned Project" })],
      }),
    );

    expect(section.referencedProjects).toEqual([]);
  });

  it("resolves a referenced-only archived project's name (design Open Question 2)", () => {
    // The author's stage assignment on an archived project is skipped from
    // `projects`, so the project counts as referenced-only — yet its name
    // still resolves rather than degrading to a placeholder.
    const section = mapRow(
      baseRow({
        author: {
          name: "Lead 1",
          role: "lead",
          id: AUTHOR_ID,
          stageAssignments: [
            {
              userId: AUTHOR_ID,
              stageId: STAGE_ID,
              projectId: OWNED_PROJECT,
              project: {
                id: OWNED_PROJECT,
                name: "Archived Project",
                archived: true,
              },
              stage: { id: STAGE_ID, name: "Development", sortOrder: 4 },
            },
          ],
        },
        risks: [fabricatedRisk(OWNED_PROJECT, { name: "Archived Project" })],
      }),
    );

    expect(section.projects).toEqual([]);
    expect(section.referencedProjects).toEqual([
      { projectId: OWNED_PROJECT, projectName: "Archived Project" },
    ]);
  });

  it("skips rows without a loaded project relation (legacy fixture shape)", () => {
    const section = mapRow(
      baseRow({
        risks: [fabricatedRisk(UNOWNED_PROJECT, undefined)],
      }),
    );

    expect(section.referencedProjects).toEqual([]);
  });
});

// unassigned-stage-reporting-exclusion: the read model exposes a per-product
// `stageSet` — the union of all leads' assignments on the product — as READ-ONLY
// display metadata. The writable `ownedStages` stays the author's own stages, so
// the write path (handleProductsChange skips non-mine chips; sectionToDraftPayload
// and saveSection persist from ownedStages only) can never write a foreign stage.
describe("mapPrismaToReportSection — assigned-stage set", () => {
  // A row where the author owns Development, and the product also carries a
  // Testing assignment held by ANOTHER lead.
  function rowWithCrossLeadAssignments(): FabricatedRow {
    return baseRow({
      author: {
        name: "Lead 1",
        role: "lead",
        id: AUTHOR_ID,
        stageAssignments: [
          {
            userId: AUTHOR_ID,
            stageId: STAGE_ID,
            projectId: OWNED_PROJECT,
            project: {
              id: OWNED_PROJECT,
              name: "Owned Project",
              archived: false,
              // The product's full assignment set across all leads.
              stageAssignments: [
                {
                  stageId: STAGE_ID,
                  stage: { id: STAGE_ID, name: "Development", sortOrder: 4 },
                },
                {
                  stageId: TESTING_STAGE_ID,
                  stage: {
                    id: TESTING_STAGE_ID,
                    name: "Testing",
                    sortOrder: 5,
                  },
                },
                // Duplicate Development row (e.g. a second relation read) must
                // dedupe by stageId, not double-count.
                {
                  stageId: STAGE_ID,
                  stage: { id: STAGE_ID, name: "Development", sortOrder: 4 },
                },
              ],
            },
            stage: { id: STAGE_ID, name: "Development", sortOrder: 4 },
          },
        ],
      },
    });
  }

  it("exposes the union of all leads' assignments, deduped and ordered by sortOrder", () => {
    const project = mapRow(rowWithCrossLeadAssignments()).projects.find(
      (p) => p.projectId === OWNED_PROJECT,
    );

    expect(project?.stageSet).toEqual([
      { stageId: STAGE_ID, stageName: "Development", sortOrder: 4 },
      { stageId: TESTING_STAGE_ID, stageName: "Testing", sortOrder: 5 },
    ]);
  });

  it("keeps a foreign stage in stageSet but OUT of ownedStages (write path stays owned-only)", () => {
    const project = mapRow(rowWithCrossLeadAssignments()).projects.find(
      (p) => p.projectId === OWNED_PROJECT,
    );

    // Testing is assigned to another lead: visible as display metadata...
    expect(project?.stageSet?.map((s) => s.stageName)).toContain("Testing");
    // ...but never in the writable ownedStages, so a lead can never persist a
    // status for a stage they do not own.
    expect(project?.ownedStages?.map((s) => s.stageName)).toEqual([
      "Development",
    ]);
  });

  it("falls back to an empty stageSet when the project carries no assignment relation (legacy fixture)", () => {
    // baseRow's project omits `stageAssignments` (pre-include shape); the mapper
    // must not throw and yields an empty set (web falls back to ownedStages).
    const project = mapRow(baseRow()).projects.find(
      (p) => p.projectId === OWNED_PROJECT,
    );

    expect(project?.stageSet).toEqual([]);
  });
});

// fix-published-empty-stage-risk-floor (task 3.2): the PDF export product
// mapping inherits the floor because it maps via the SAME
// mapPrismaToReportSection. These pin the mapper-level floor: an OWNED stage
// with no submitted status (`StageStatus.status = null`, i.e. absent from
// `stageStatuses`) covered by the author's OWN risk floors the product's
// derived `trafficLight` — while the raw per-stage `status` stays null (D4).
describe("mapPrismaToReportSection — own-risk product floor", () => {
  function coveringRisk(severity: "blocked" | "at-risk", stageNames: string[]) {
    return {
      id: "77777777-7777-4777-8777-777777777777",
      projectId: OWNED_PROJECT,
      risk: "Own covering risk",
      impact: "High",
      mitigation: "Mitigate",
      severity,
      stageNames,
      project: { name: "Owned Project" },
    };
  }

  it("floors red for a covers-all blocked own risk on an owned empty stage", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          {
            projectId: OWNED_PROJECT,
            status: "green",
            project: {
              id: OWNED_PROJECT,
              name: "Owned Project",
              archived: false,
            },
          },
        ],
        risks: [coveringRisk("blocked", [])],
      }),
    );

    const project = section.projects.find((p) => p.projectId === OWNED_PROJECT);
    expect(project?.trafficLight).toBe("red");
    // D4: the raw per-stage status stays empty (null) — only the derived
    // product-level trafficLight is floored.
    expect(project?.ownedStages?.[0]?.status ?? null).toBeNull();
  });

  it("floors yellow for a covers-all at-risk own risk on an owned empty stage", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          {
            projectId: OWNED_PROJECT,
            status: "green",
            project: {
              id: OWNED_PROJECT,
              name: "Owned Project",
              archived: false,
            },
          },
        ],
        risks: [coveringRisk("at-risk", [])],
      }),
    );

    expect(
      section.projects.find((p) => p.projectId === OWNED_PROJECT)?.trafficLight,
    ).toBe("yellow");
  });

  it("never lowers: a real red ProjectStatus survives a milder own risk", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          {
            projectId: OWNED_PROJECT,
            status: "red",
            project: {
              id: OWNED_PROJECT,
              name: "Owned Project",
              archived: false,
            },
          },
        ],
        risks: [coveringRisk("at-risk", [])],
      }),
    );

    expect(
      section.projects.find((p) => p.projectId === OWNED_PROJECT)?.trafficLight,
    ).toBe("red");
  });

  // unassigned-stage-reporting-exclusion (task 4.1): a risk naming a stage the
  // author does NOT own never floored the product (the floor folds risks through
  // OWNED stages only), so excluding such a vacant stage changes no health
  // number — and the risk stays listed in the risk section, so the severity is
  // always explained by a visible object even with no stage chip.
  it("a risk on a non-owned (vacant) stage does not floor health and stays listed", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          {
            projectId: OWNED_PROJECT,
            status: "green",
            project: {
              id: OWNED_PROJECT,
              name: "Owned Project",
              archived: false,
            },
          },
        ],
        // Author owns Development; this blocked risk names Testing only.
        risks: [coveringRisk("blocked", ["Testing"])],
      }),
    );

    const project = section.projects.find((p) => p.projectId === OWNED_PROJECT);
    // Health is unchanged — the vacant Testing stage never drove the light.
    expect(project?.trafficLight).toBe("green");
    // The covering risk is still listed (explains any severity without a chip).
    expect(section.risks.map((r) => r.risk)).toContain("Own covering risk");
  });
});

// ---------------------------------------------------------------------------
// saveSection — optimistic-concurrency compare-and-set
// ---------------------------------------------------------------------------

describe("ReportSectionsPrismaRepository.saveSection — version compare-and-set", () => {
  function makeTx(updateCount: number) {
    const noop = vi.fn(() => Promise.resolve({ count: 0 }));
    return {
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: updateCount })),
      },
      projectStatus: { deleteMany: noop, createMany: noop },
      stageStatus: { deleteMany: noop, createMany: noop },
      item: {
        deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        createMany: noop,
      },
      risk: { deleteMany: noop, createMany: noop },
      decision: { deleteMany: noop, createMany: noop },
      // review-acknowledgement (comment-aware save): capture reads existing
      // comments before the child delete-recreate. No comments here → the
      // re-insert step is skipped, so record findMany stubs are not needed.
      recordComment: {
        findMany: vi.fn(() => Promise.resolve([])),
        createMany: noop,
      },
    };
  }

  function buildRepo(updateCount: number, reReadVersion = 1) {
    const tx = makeTx(updateCount);
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
      reportSection: {
        // The post-commit re-read carries the row's NEW version; the returned
        // read model must reflect this fresh fetch, not the input section.
        findUnique: vi.fn(() =>
          Promise.resolve(baseRow({ version: reReadVersion })),
        ),
      },
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);
    return { repo, tx };
  }

  // A read model to write; saveSection takes the EXPECTED version separately,
  // so this object's own version is irrelevant to the compare-and-set.
  const section = mapRow(baseRow());

  it("matching version: updates with {id, version} + increment, then runs the child writes", async () => {
    // Input section carries version 1; the post-commit re-read yields 4. The
    // returned model must report 4 (from the fresh fetch), proving the new
    // version round-trips to the client rather than echoing the stale input.
    const { repo, tx } = buildRepo(1, 4);

    const saved = await repo.saveSection(section, 3);

    expect(tx.reportSection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: section.reportSectionId, version: 3 },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    // The compare-and-set matched, so the delete-then-recreate ran.
    expect(tx.item.deleteMany).toHaveBeenCalled();
    // The returned read model reflects the post-increment re-read.
    expect(saved.version).toBe(4);
  });

  it("stale version: zero-row match throws SectionVersionConflictError and deletes nothing", async () => {
    const { repo, tx } = buildRepo(0);

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
    // Conflict aborts BEFORE any deleteMany — no child rows touched.
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });
});
