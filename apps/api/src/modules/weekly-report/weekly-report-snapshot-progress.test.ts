import {
  adminReportPeriodSchema,
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  buildPublishedReadModelFromSnapshot,
  buildSnapshotResult,
} from "./weekly-report-read-model.js";

const GROUP = "00000000-0000-4000-8000-000000000099";
const authorIds = Array.from(
  { length: 10 },
  (_, index) => `00000000-0000-4000-8000-0000000001${index}0`,
);

// Scoping itself is covered in report-sections; here it hands a group's view
// (no sections) back so only the progress denominator is under test.
vi.mock("../report-sections/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../report-sections/index.js")>()),
  requireScopedPublishedSnapshot: (snapshot: PublishedReportSnapshot) => ({
    ...snapshot,
    sections: [],
  }),
}));

const snapshot = {
  reportId: "00000000-0000-4000-8000-000000000002",
  periodStart: "2026-04-14T00:00:00.000Z",
  periodEnd: "2026-04-18T00:00:00.000Z",
  deadline: null,
  sections: authorIds.map((authorId, index) => ({
    authorId,
    status: index < 3 ? "submitted" : "draft",
  })),
} as unknown as PublishedReportSnapshot;

const metadata = {
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: "Week 16",
} as const;

function progressFor(role: UserSession["role"]) {
  const session = {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "x@example.test",
    name: "X",
    role,
    reportingGroupId: GROUP,
  } as UserSession;
  const { readModel } = buildSnapshotResult(
    metadata as never,
    snapshot,
    session,
  );
  return [readModel.submissionCount, readModel.totalLeads];
}

describe("buildSnapshotResult progress", () => {
  it("counts the full snapshot for head and admin", () => {
    expect(progressFor("head")).toEqual([3, 10]);
    expect(progressFor("admin")).toEqual([3, 10]);
  });

  it("counts only the scoped snapshot for a lead", () => {
    expect(progressFor("lead")).toEqual([0, 0]);
  });
});

describe("buildPublishedReadModelFromSnapshot orgProgress", () => {
  it("prefers the org-wide progress frozen into a scoped PDF snapshot", () => {
    const scoped = {
      ...snapshot,
      sections: [],
      orgProgress: { submitted: 9, total: 9 },
    } as unknown as PublishedReportSnapshot;
    const model = buildPublishedReadModelFromSnapshot(scoped, metadata);
    expect([model.submissionCount, model.totalLeads]).toEqual([9, 9]);
  });
});

const FROZEN_REPORT = "70000000-0000-4000-8000-000000000001";
const FROZEN_SECTION = "70000000-0000-4000-8000-000000000002";
const FROZEN_AUTHOR = "70000000-0000-4000-8000-000000000003";
const FROZEN_PRODUCT = "70000000-0000-4000-8000-000000000004";
const FROZEN_STAGE = "70000000-0000-4000-8000-000000000005";
const FROZEN_ITEM = "70000000-0000-4000-8000-000000000006";
const FROZEN_STABLE = "70000000-0000-4000-8000-000000000007";
const FROZEN_OTHER_ITEM = "70000000-0000-4000-8000-000000000008";
const FROZEN_OTHER_STABLE = "70000000-0000-4000-8000-000000000009";

function frozenSection() {
  return {
    reportSectionId: FROZEN_SECTION,
    reportId: FROZEN_REPORT,
    authorId: FROZEN_AUTHOR,
    authorName: "Frozen Lead",
    authorRole: "lead",
    groupId: GROUP,
    groupName: "Frozen group",
    version: 1,
    status: "submitted",
    submittedAt: "2026-04-18T10:00:00Z",
    late: false,
    projects: [
      {
        projectId: FROZEN_PRODUCT,
        projectName: "Owned",
        trafficLight: "green",
        ownerGroupId: GROUP,
        ownedStages: [
          {
            stageId: FROZEN_STAGE,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [
          { stageId: FROZEN_STAGE, stageName: "Development", sortOrder: 0 },
        ],
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}
function frozenItem(id: string, stableId: string) {
  return {
    id,
    stableId,
    projectId: FROZEN_PRODUCT,
    type: "current",
    text: "Frozen work",
    tag: "Dev",
    workflowStatus: "done",
    carriedOver: false,
    stageNames: ["Development"],
  };
}
function frozenSnapshot(sections: readonly unknown[]) {
  return {
    reportId: FROZEN_REPORT,
    periodStart: "2026-04-14T00:00:00Z",
    periodEnd: "2026-04-20T23:59:59.999Z",
    deadline: null,
    status: "published",
    publishedAt: "2026-04-21T10:00:00Z",
    publishedById: FROZEN_AUTHOR,
    publishedByName: "Frozen Lead",
    portfolioOverview: {
      status: "green",
      totals: { green: 1, yellow: 0, red: 0 },
    },
    sections,
  };
}
function recoveryPeriod(publishedSnapshot: unknown) {
  return {
    id: FROZEN_REPORT,
    periodStart: "2026-04-14T00:00:00Z",
    periodEnd: "2026-04-20T23:59:59.999Z",
    deadline: null,
    weekLabel: null,
    status: "published",
    periodState: "published",
    periodStatus: "published",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: "2026-04-21T10:00:00Z",
    publishedById: FROZEN_AUTHOR,
    reopenedAt: null,
    publishedSnapshot,
  };
}

describe("admitted frozen read — owning metadata priority", () => {
  it.each([true, false])(
    "keeps owned risk/portfolio names when reference collision=%s",
    (collision) => {
      const section = frozenSection();
      const parsed = publishedReportSnapshotSchema.parse(
        frozenSnapshot([
          {
            ...section,
            referencedProjects: collision
              ? [{ projectId: FROZEN_PRODUCT, projectName: "Stale" }]
              : [],
            risks: [
              {
                id: FROZEN_ITEM,
                stableId: FROZEN_STABLE,
                projectId: FROZEN_PRODUCT,
                risk: "Deployment blocked",
                impact: "Delivery delayed",
                mitigation: "Fix gate",
                severity: "blocked",
                stageNames: ["Development"],
              },
            ],
          },
        ]),
      );
      const read = buildPublishedReadModelFromSnapshot(parsed, metadata);
      expect(read.portfolioOverview[0]?.productName).toBe("Owned");
      expect(
        read.escalations.find((row) => row.type === "blocked")?.productName,
      ).toBe("Owned");
    },
  );
  it("keeps reference-only product labels", () => {
    const parsed = publishedReportSnapshotSchema.parse(
      frozenSnapshot([
        {
          ...frozenSection(),
          projects: [],
          referencedProjects: [
            { projectId: FROZEN_PRODUCT, projectName: "Reference only" },
          ],
          risks: [
            {
              id: FROZEN_ITEM,
              stableId: FROZEN_STABLE,
              projectId: FROZEN_PRODUCT,
              risk: "Deployment blocked",
              impact: "Delivery delayed",
              mitigation: "Fix gate",
              severity: "blocked",
              stageNames: ["Development"],
            },
          ],
        },
      ]),
    );
    const read = buildPublishedReadModelFromSnapshot(parsed, metadata);
    expect(read.portfolioOverview[0]?.productName).toBe("Reference only");
    expect(read.escalations[0]?.productName).toBe("Reference only");
  });
});

describe("recovered publication — per-section Item lineage identity", () => {
  it("rejects later distinct physical items sharing a stableId before recovery", () => {
    const raw = frozenSnapshot([
      {
        ...frozenSection(),
        items: [
          frozenItem(FROZEN_ITEM, FROZEN_STABLE),
          frozenItem(FROZEN_OTHER_ITEM, FROZEN_STABLE),
        ],
      },
    ]);
    const result = publishedReportSnapshotSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["sections", 0, "items", 1, "stableId"],
        }),
      );
    expect(adminReportPeriodSchema.safeParse(recoveryPeriod(raw)).success).toBe(
      false,
    );
  });
  it("keeps unique same-section item lineages and valid recovery", () => {
    const raw = frozenSnapshot([
      {
        ...frozenSection(),
        items: [
          frozenItem(FROZEN_ITEM, FROZEN_STABLE),
          frozenItem(FROZEN_OTHER_ITEM, FROZEN_OTHER_STABLE),
        ],
      },
    ]);
    const parsed = publishedReportSnapshotSchema.parse(raw);
    expect(adminReportPeriodSchema.safeParse(recoveryPeriod(raw)).success).toBe(
      true,
    );
    expect(
      buildPublishedReadModelFromSnapshot(parsed, metadata).leadSections[0]
        ?.items,
    ).toHaveLength(2);
  });
  it("allows the same lineage in different sections/authors", () => {
    const raw = frozenSnapshot([
      { ...frozenSection(), items: [frozenItem(FROZEN_ITEM, FROZEN_STABLE)] },
      {
        ...frozenSection(),
        reportSectionId: FROZEN_OTHER_STABLE,
        authorId: FROZEN_OTHER_ITEM,
        authorName: "Other lead",
        items: [frozenItem(FROZEN_OTHER_ITEM, FROZEN_STABLE)],
      },
    ]);
    expect(publishedReportSnapshotSchema.safeParse(raw).success).toBe(true);
    expect(adminReportPeriodSchema.safeParse(recoveryPeriod(raw)).success).toBe(
      true,
    );
  });
  it("keeps the separate physical record identity guard", () => {
    const raw = frozenSnapshot([
      {
        ...frozenSection(),
        items: [
          frozenItem(FROZEN_ITEM, FROZEN_STABLE),
          frozenItem(FROZEN_ITEM, FROZEN_OTHER_STABLE),
        ],
      },
    ]);
    const result = publishedReportSnapshotSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["sections", 0, "items", 1, "id"] }),
      );
  });
});
