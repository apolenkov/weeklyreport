// How many unfinished risks and decisions an analytics reader is told a period
// leaves out (openspec: lead-incomplete-record-drafts, task 4.6). The totals
// follow the same snapshot, readable sections, lead and Product as the facts.
import type { RecordOmission, UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository.js";

const REPORT = "30000000-0000-4000-8000-000000000001";
const GROUP_A = "30000000-0000-4000-8000-00000000000a";
const GROUP_B = "30000000-0000-4000-8000-00000000000b";
const LEAD_A = "30000000-0000-4000-8000-000000000011";
const LEAD_B = "30000000-0000-4000-8000-000000000012";
const PROJECT_A = "30000000-0000-4000-8000-000000000021";
const PROJECT_B = "30000000-0000-4000-8000-000000000022";
const INPUT = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

const head: UserSession = {
  userId: "30000000-0000-4000-8000-000000000031",
  email: "head@example.com",
  name: "Head",
  role: "head",
  reportingGroupId: GROUP_A,
};
const admin: UserSession = { ...head, role: "admin" };

const bucket = (
  kind: "risk" | "decision",
  parentId: string,
  count: number,
) => ({
  kind,
  parentKind: "product" as const,
  parentId,
  stageNames: ["Development"],
  count,
});

interface SectionInput {
  readonly index: number;
  readonly authorId: string;
  readonly groupId: string;
  readonly projectId: string;
  readonly recordOmission?: RecordOmission;
}

function section(input: SectionInput) {
  return {
    reportSectionId: `30000000-0000-4000-8000-0000000001${String(input.index).padStart(2, "0")}`,
    reportId: REPORT,
    authorId: input.authorId,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: "2026-04-20T12:00:00.000Z",
    late: false,
    projects: [
      {
        projectId: input.projectId,
        projectName: "Project",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: input.groupId,
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: input.groupId,
    groupName: "Group",
    ...(input.recordOmission ? { recordOmission: input.recordOmission } : {}),
  };
}

function repositoryFor(sections: readonly SectionInput[]) {
  const row = {
    id: REPORT,
    periodEnd: new Date("2026-04-21T12:00:00.000Z"),
    createdAt: new Date("2026-04-22T12:00:00.000Z"),
    publishedSnapshot: {
      reportId: REPORT,
      periodStart: "2026-04-15T00:00:00.000Z",
      periodEnd: "2026-04-21T12:00:00.000Z",
      deadline: "2026-04-20T00:00:00.000Z",
      status: "published",
      publishedAt: "2026-04-21T13:00:00.000Z",
      publishedById: null,
      publishedByName: null,
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: sections.map(section),
    },
  };
  const prisma = {
    report: { findMany: vi.fn().mockResolvedValue([row]) },
  } as unknown as PrismaService;
  return new AnalyticsPrismaRepository(prisma);
}

const ownSection: SectionInput = {
  index: 1,
  authorId: LEAD_A,
  groupId: GROUP_A,
  projectId: PROJECT_A,
  recordOmission: {
    version: 1,
    buckets: [bucket("risk", PROJECT_A, 2), bucket("decision", PROJECT_B, 1)],
  },
};
const foreignSection: SectionInput = {
  index: 2,
  authorId: LEAD_B,
  groupId: GROUP_B,
  projectId: PROJECT_B,
  recordOmission: { version: 1, buckets: [bucket("risk", PROJECT_B, 5)] },
};

describe("AnalyticsPrismaRepository omission totals", () => {
  it("counts only the sections the reader may see", async () => {
    const repo = repositoryFor([ownSection, foreignSection]);

    const scoped = await repo.trafficLightHistory(INPUT, head);
    const whole = await repo.trafficLightHistory(INPUT, admin);

    expect(scoped.periods[0]?.omissions).toEqual({
      risks: 2,
      decisions: 1,
      unknown: false,
    });
    expect(whole.periods[0]?.omissions).toEqual({
      risks: 7,
      decisions: 1,
      unknown: false,
    });
  });

  it("follows the Product and lead filters of the history", async () => {
    const repo = repositoryFor([ownSection, foreignSection]);

    const byProduct = await repo.trafficLightHistory(
      { ...INPUT, projectId: PROJECT_B },
      admin,
    );
    const byLead = await repo.trafficLightHistory(
      { ...INPUT, leadId: LEAD_B },
      admin,
    );

    expect(byProduct.periods[0]?.omissions).toEqual({
      risks: 5,
      decisions: 1,
      unknown: false,
    });
    expect(byLead.periods[0]?.omissions).toEqual({
      risks: 5,
      decisions: 0,
      unknown: false,
    });
  });

  it("answers zero for a counted period and unknown for a legacy one", async () => {
    const counted = repositoryFor([
      { ...ownSection, recordOmission: { version: 1, buckets: [] } },
    ]);
    const { recordOmission: _dropped, ...legacySection } = ownSection;
    const legacy = repositoryFor([legacySection]);

    const [countedVelocity] = await counted.leadVelocity(INPUT, head);
    const [legacyVelocity] = await legacy.leadVelocity(INPUT, head);
    const comparison = await legacy.periodComparison(
      { periodA: "2026-04-21", periodB: "2026-04-21" },
      head,
    );

    expect(countedVelocity?.omissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
    expect(legacyVelocity?.omissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: true,
    });
    expect(comparison.periodA?.omissions.unknown).toBe(true);
  });
});
