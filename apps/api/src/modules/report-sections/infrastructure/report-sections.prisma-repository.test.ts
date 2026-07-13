// fix-lead-surface-name-resolution: pins the name-only `referencedProjects`
// emission of mapPrismaToReportSection — rows (items / risks / decisions)
// referencing a project the section author owns no stage on contribute the
// project's name so the lead-surface mappers never show "Unknown"/"Group"
// for a product the system can name.
import type { TrafficLightStatus } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { SectionVersionConflictError } from "../application/report-sections.service";
import type { PrismaReportSectionWithRelations } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

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
  | "activityStatuses"
  | "sectionReviews"
> & {
  id: string;
  reportId: string;
  authorId: string;
  status: string;
  submittedAt: Date | null;
  late: boolean;
  version: number;
};

// The generated payload always carries the
// full base scalar columns for every `include`d relation (Project, Item,
// Risk, Decision, Stage, StageAssignment, ...), not just the fields the
// mapper reads. These factories supply honest defaults for those columns so
// individual tests only spell out what they actually care about.
const FIXED_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

function fullProjectScalars(
  overrides: Partial<{ id: string; name: string; archived: boolean }> = {},
) {
  return {
    id: overrides.id ?? OWNED_PROJECT,
    name: overrides.name ?? "Owned Project",
    archived: overrides.archived ?? false,
    leadId: AUTHOR_ID,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

function fullStage(id: string, name: string, sortOrder: number) {
  return { id, name, sortOrder, createdAt: FIXED_TIMESTAMP };
}

function fullCrossLeadAssignment(id: string, name: string, sortOrder: number) {
  return {
    id: `${id}-assignment`,
    userId: AUTHOR_ID,
    stageId: id,
    projectId: OWNED_PROJECT,
    createdAt: FIXED_TIMESTAMP,
    stage: fullStage(id, name, sortOrder),
  };
}

function fullOwnedStageAssignment(
  overrides: {
    project?: Partial<{ name: string; archived: boolean }>;
    crossLeadAssignments?: ReturnType<typeof fullCrossLeadAssignment>[];
  } = {},
) {
  return {
    id: `${STAGE_ID}-owned-assignment`,
    userId: AUTHOR_ID,
    stageId: STAGE_ID,
    projectId: OWNED_PROJECT,
    createdAt: FIXED_TIMESTAMP,
    project: {
      ...fullProjectScalars(overrides.project),
      stageAssignments: overrides.crossLeadAssignments ?? [],
      lead: { reportingGroupId: null },
    },
    stage: fullStage(STAGE_ID, "Development", 4),
  };
}

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
      reportingGroupId: null,
      stageAssignments: [fullOwnedStageAssignment()],
    },
    projectStatuses: [],
    stageStatuses: [],
    items: [],
    risks: [],
    decisions: [],
    activityStatuses: [],
    sectionReviews: [],
    ...overrides,
  };
}

function mapRow(row: FabricatedRow) {
  return mapPrismaToReportSection(
    row as unknown as PrismaReportSectionWithRelations,
  );
}

function fullProjectStatus(overrides: {
  projectId: string;
  status: TrafficLightStatus | null;
  project?: Partial<{ id: string; name: string; archived: boolean }>;
}) {
  return {
    id: `${overrides.projectId}-status`,
    reportSectionId: SECTION_ID,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    projectId: overrides.projectId,
    status: overrides.status,
    project: fullProjectScalars(overrides.project),
  };
}

function fullItem(
  overrides: Partial<{
    id: string;
    projectId: string | null;
    activityId: string | null;
    type: "current" | "next";
    text: string;
    tag: string;
    workflowStatus: "planned" | "in_progress" | "paused" | "postponed" | "done";
    carriedOver: boolean;
    priorityRank: number | null;
    stageNames: string[];
    project: { name: string } | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "88888888-8888-4888-8888-888888888888",
    stableId: overrides.id ?? "88888888-8888-4888-8888-888888888888",
    reportSectionId: SECTION_ID,
    projectId: overrides.projectId ?? null,
    activityId: overrides.activityId ?? null,
    type: overrides.type ?? "current",
    text: overrides.text ?? "Item",
    tag: overrides.tag ?? "feature",
    workflowStatus: overrides.workflowStatus ?? "in_progress",
    carriedOver: overrides.carriedOver ?? false,
    priorityRank: overrides.priorityRank ?? null,
    pausedReason: null,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    stageNames: overrides.stageNames ?? [],
    project: overrides.project ?? null,
    recordComments: [],
  };
}

function fullRisk(
  overrides: Partial<{
    id: string;
    projectId: string | null;
    activityId: string | null;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
    project: { name: string } | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "77777777-7777-4777-8777-777777777777",
    stableId: overrides.id ?? "77777777-7777-4777-8777-777777777777",
    reportSectionId: SECTION_ID,
    projectId: overrides.projectId ?? null,
    activityId: overrides.activityId ?? null,
    risk: overrides.risk ?? "Risk",
    impact: overrides.impact ?? "Impact",
    mitigation: overrides.mitigation ?? "Mitigation",
    severity: overrides.severity ?? "at-risk",
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    stageNames: overrides.stageNames ?? [],
    project: overrides.project ?? null,
    recordComments: [],
  };
}

function fullDecision(
  overrides: Partial<{
    id: string;
    productId: string | null;
    activityId: string | null;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageNames: string[];
    project: { name: string } | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "99999999-9999-4999-8999-999999999999",
    stableId: overrides.id ?? "99999999-9999-4999-8999-999999999999",
    reportSectionId: SECTION_ID,
    productId: overrides.productId ?? null,
    activityId: overrides.activityId ?? null,
    text: overrides.text ?? "Decision",
    owner: overrides.owner ?? "Owner",
    deadline: overrides.deadline ?? null,
    impact: overrides.impact ?? "Impact",
    resolvedAt: overrides.resolvedAt ?? null,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    stageNames: overrides.stageNames ?? [],
    project: overrides.project ?? null,
    recordComments: [],
  };
}

describe("mapPrismaToReportSection — referencedProjects", () => {
  it("emits a name-only entry for a project a risk references but the author owns no stage on", () => {
    const section = mapRow(
      baseRow({
        risks: [
          fullRisk({
            projectId: UNOWNED_PROJECT,
            project: { name: "Foreign Project" },
          }),
        ],
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
          fullItem({
            projectId: UNOWNED_PROJECT,
            text: "Cross-stage item",
            project: { name: "Foreign Project" },
          }),
        ],
        decisions: [
          fullDecision({
            productId: UNOWNED_PROJECT,
            text: "Cross-stage decision",
            project: { name: "Foreign Project" },
          }),
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
        risks: [
          fullRisk({
            projectId: OWNED_PROJECT,
            project: { name: "Owned Project" },
          }),
        ],
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
          reportingGroupId: null,
          stageAssignments: [
            fullOwnedStageAssignment({
              project: { name: "Archived Project", archived: true },
            }),
          ],
        },
        risks: [
          fullRisk({
            projectId: OWNED_PROJECT,
            project: { name: "Archived Project" },
          }),
        ],
      }),
    );

    expect(section.projects).toEqual([]);
    expect(section.referencedProjects).toEqual([
      { projectId: OWNED_PROJECT, projectName: "Archived Project" },
    ]);
  });

  it("skips rows without a loaded project relation (legacy fixture shape)", () => {
    // A real DB row's nullable `project` relation surfaces as `null`, never
    // `undefined` — this pins the honest contract (the hand-written type
    // used to model it as optional-absent).
    const section = mapRow(
      baseRow({
        risks: [fullRisk({ projectId: UNOWNED_PROJECT, project: null })],
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
describe("mapPrismaToReportSection — ownerGroupId freeze", () => {
  it("stamps each project entry with the PRODUCT lead's reporting group, not the section author's", () => {
    const assignment = fullOwnedStageAssignment();
    const row = baseRow({
      author: {
        name: "Lead 1",
        role: "lead",
        id: AUTHOR_ID,
        // The section author's own group differs from the product owner's —
        // a stamp that read the author's group would leak through here.
        reportingGroupId: "e0000000-0000-4000-a000-0000000000a1",
        stageAssignments: [
          {
            ...assignment,
            project: {
              ...assignment.project,
              lead: {
                reportingGroupId: "e0000000-0000-4000-a000-0000000000b2",
              },
            },
          },
        ],
      },
    });

    const mapped = mapRow(row);

    expect(mapped.projects[0]?.ownerGroupId).toBe(
      "e0000000-0000-4000-a000-0000000000b2",
    );
  });

  it("freezes a null ownerGroupId for a product whose lead has no group", () => {
    const mapped = mapRow(baseRow());

    expect(mapped.projects[0]?.ownerGroupId).toBeNull();
  });
});

describe("mapPrismaToReportSection — assigned-stage set", () => {
  // A row where the author owns Development, and the product also carries a
  // Testing assignment held by ANOTHER lead.
  function rowWithCrossLeadAssignments(): FabricatedRow {
    return baseRow({
      author: {
        name: "Lead 1",
        role: "lead",
        id: AUTHOR_ID,
        reportingGroupId: null,
        stageAssignments: [
          fullOwnedStageAssignment({
            // The product's full assignment set across all leads.
            crossLeadAssignments: [
              fullCrossLeadAssignment(STAGE_ID, "Development", 4),
              fullCrossLeadAssignment(TESTING_STAGE_ID, "Testing", 5),
              // Duplicate Development row (e.g. a second relation read) must
              // dedupe by stageId, not double-count.
              fullCrossLeadAssignment(STAGE_ID, "Development", 4),
            ],
          }),
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

  it("yields an empty stageSet when the project carries no cross-lead assignment", () => {
    // baseRow's project has an empty stageAssignments array; the mapper must
    // not throw and yields an empty set (web falls back to ownedStages).
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
    return fullRisk({
      risk: "Own covering risk",
      impact: "High",
      mitigation: "Mitigate",
      projectId: OWNED_PROJECT,
      severity,
      stageNames,
      project: { name: "Owned Project" },
    });
  }

  it("floors red for a covers-all blocked own risk on an owned empty stage", () => {
    const section = mapRow(
      baseRow({
        projectStatuses: [
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
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
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
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
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "red" }),
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
          fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
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
  function makeTx(updateCount: number, reReadResult: FabricatedRow | null) {
    const noop = vi.fn(() => Promise.resolve({ count: 0 }));
    return {
      // The publish/save row lock (SELECT ... FOR UPDATE on the parent
      // report) runs before the version compare-and-set; an open period lets
      // these characterizations exercise the version lock itself.
      $queryRaw: vi.fn(() => Promise.resolve([{ periodStatus: "open" }])),
      reportSection: {
        updateMany: vi.fn(() => Promise.resolve({ count: updateCount })),
        // The re-read now happens INSIDE the transaction (on `tx`, not the
        // outer `prisma` client) — it carries the row's NEW version, so the
        // returned model must reflect this fresh fetch rather than echoing
        // the stale input.
        findUnique: vi.fn(() => Promise.resolve(reReadResult)),
      },
      projectStatus: { deleteMany: noop, createMany: noop },
      stageStatus: { deleteMany: noop, createMany: noop },
      activityStatus: { deleteMany: noop, createMany: noop },
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
    const tx = makeTx(updateCount, baseRow({ version: reReadVersion }));
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
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
    // The re-read happened on `tx` (inside the transaction), never on a
    // separate outer client.
    expect(tx.reportSection.findUnique).toHaveBeenCalledWith({
      where: { id: section.reportSectionId },
      include: expect.anything() as unknown,
    });
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

  it("concurrent deletion: an empty in-transaction re-read throws SectionVersionConflictError, not a crash", async () => {
    // This scenario is structurally unreachable in a real Postgres
    // transaction (the delete's cascade would block on this transaction's
    // locks), but the defensive guard must still convert a `null` re-read
    // into the same clean conflict error the client already retries on —
    // never crash on `null.id`.
    const tx = makeTx(1, null);
    const prisma = {
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const repo = new ReportSectionsPrismaRepository(prisma as never);

    await expect(repo.saveSection(section, 3)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
  });
});

// activity-first-class: the mapper keeps activity-parented records in the FLAT
// top-level arrays (discriminated by activityId, product FK null), joins each
// activity's label-only linkedProducts, and floors the pill by its OWN records
// (design decision 5) without ever rewriting the stored ActivityStatus.status.
describe("mapPrismaToReportSection — activity derived-status floor", () => {
  const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LINKED_PRODUCT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const activityItem = (
    workflowStatus: "planned" | "in_progress" | "paused" | "postponed" | "done",
  ) =>
    fullItem({
      activityId: ACTIVITY_ID,
      text: "Activity item",
      workflowStatus,
    });

  const activityRisk = (severity: string) =>
    fullRisk({ activityId: ACTIVITY_ID, risk: "Activity risk", severity });

  const activityRow = (over: {
    items?: ReturnType<typeof fullItem>[];
    risks?: ReturnType<typeof fullRisk>[];
    storedStatus?: TrafficLightStatus | null;
  }): FabricatedRow =>
    baseRow({
      items: over.items ?? [],
      risks: over.risks ?? [],
      activityStatuses: [
        {
          id: `${ACTIVITY_ID}-status`,
          reportSectionId: SECTION_ID,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
          activityId: ACTIVITY_ID,
          status: over.storedStatus ?? "green",
          note: null,
          activity: {
            name: "Jira triage duty",
            activityProducts: [
              { product: { id: LINKED_PRODUCT, name: "CRM Portal" } },
            ],
          },
        },
      ],
    });

  it("keeps an activity-parented item in the flat items array, product FK null", () => {
    const section = mapRow(
      activityRow({ items: [activityItem("in_progress")] }),
    );
    expect(section.items).toHaveLength(1);
    expect(section.items[0]?.activityId).toBe(ACTIVITY_ID);
    expect(section.items[0]?.projectId ?? null).toBeNull();
  });

  it("joins linkedProducts (id + name) onto the activity", () => {
    const section = mapRow(activityRow({}));
    expect(section.activities[0]?.linkedProducts).toEqual([
      { productId: LINKED_PRODUCT, productName: "CRM Portal" },
    ]);
  });

  it("an item's progress status never floors the pill (alarms are risks)", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", items: [activityItem("paused")] }),
    );
    expect(section.activities[0]?.status).toBe("green");
    expect(section.activities[0]?.derivedStatus).toBe("green");
  });

  it("floors at least yellow for a covering at-risk own risk", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", risks: [activityRisk("at-risk")] }),
    );
    expect(section.activities[0]?.derivedStatus).toBe("yellow");
  });

  it("floors red for a blocked own risk on a green pill", () => {
    const section = mapRow(
      activityRow({ storedStatus: "green", risks: [activityRisk("blocked")] }),
    );
    expect(section.activities[0]?.derivedStatus).toBe("red");
  });

  it("passes the stored status through when no own record floors it", () => {
    const section = mapRow(activityRow({ storedStatus: "green" }));
    expect(section.activities[0]?.derivedStatus).toBe("green");
  });
});
