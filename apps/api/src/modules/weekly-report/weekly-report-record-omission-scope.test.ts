// Whose unfinished-record totals a published weekly report discloses
// (openspec: lead-incomplete-record-drafts, task 4.3): only the totals frozen
// with the sections the reader's group scope admits. A Product another group's
// section merely references, a wider progress denominator or a missing grant
// never widens them.
import type { RecordOmission, UserSession } from "@weeklyreport/shared";
import { publishedReportSnapshotSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildSnapshotResult,
  type WeeklyReportMetadata,
} from "./weekly-report-read-model.js";

const REPORT = "10910000-0000-4000-8000-000000000001";
const GROUP_A = "10910000-0000-4000-8000-00000000000a";
const GROUP_B = "10910000-0000-4000-8000-00000000000b";
const GROUP_C = "10910000-0000-4000-8000-00000000000c";
const LEAD_A = "10910000-0000-4000-8000-000000000011";
const LEAD_B = "10910000-0000-4000-8000-000000000012";
const PROJECT_A = "10910000-0000-4000-8000-000000000021";
const PROJECT_B = "10910000-0000-4000-8000-000000000022";

const metadata = {
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: "Week 23",
} as unknown as WeeklyReportMetadata;

const risks = (parentId: string, count: number): RecordOmission => ({
  version: 1,
  buckets: [
    {
      kind: "risk",
      parentKind: "product",
      parentId,
      stageNames: ["Development"],
      count,
    },
  ],
});

interface SectionInput {
  readonly index: number;
  readonly authorId: string;
  readonly groupId: string;
  readonly projectId: string;
  readonly referencedProjectId?: string;
  readonly recordOmission: RecordOmission;
}

function section(input: SectionInput) {
  return {
    reportSectionId: `10910000-0000-4000-8000-0000000001${String(input.index).padStart(2, "0")}`,
    reportId: REPORT,
    authorId: input.authorId,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: "2026-06-05T12:00:00.000Z",
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
    referencedProjects: input.referencedProjectId
      ? [{ projectId: input.referencedProjectId, projectName: "Referenced" }]
      : [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: input.groupId,
    groupName: "Group",
    recordOmission: input.recordOmission,
  };
}

// Group A's section references group B's Product; group B's own section holds
// that Product's unfinished records.
const snapshot = publishedReportSnapshotSchema.parse({
  reportId: REPORT,
  periodStart: "2026-06-01T00:00:00.000Z",
  periodEnd: "2026-06-07T00:00:00.000Z",
  deadline: null,
  status: "published",
  publishedAt: "2026-06-07T13:00:00.000Z",
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: "green",
    totals: { green: 0, yellow: 0, red: 0 },
  },
  sections: [
    section({
      index: 1,
      authorId: LEAD_A,
      groupId: GROUP_A,
      projectId: PROJECT_A,
      referencedProjectId: PROJECT_B,
      recordOmission: risks(PROJECT_A, 2),
    }),
    section({
      index: 2,
      authorId: LEAD_B,
      groupId: GROUP_B,
      projectId: PROJECT_B,
      recordOmission: risks(PROJECT_B, 5),
    }),
  ],
});

const session = (over: Partial<UserSession>): UserSession => ({
  userId: "10910000-0000-4000-8000-000000000031",
  email: "reader@example.com",
  name: "Reader",
  role: "viewer",
  ...over,
});

const read = (reader: UserSession) =>
  buildSnapshotResult(metadata, snapshot, reader).readModel;

describe("published weekly report omission scope", () => {
  it("shows a Head only their own group's totals, not the referenced Product's", () => {
    const model = read(session({ role: "head", reportingGroupId: GROUP_A }));

    expect(model.leadSections).toHaveLength(1);
    expect(model.recordOmissions).toEqual({
      risks: 2,
      decisions: 0,
      unknown: false,
    });
  });

  it("keeps the Head's org-wide progress apart from their scoped totals", () => {
    const model = read(session({ role: "head", reportingGroupId: GROUP_A }));

    // Progress counts both groups' sections; the omission totals do not.
    expect(model.submissionCount).toBe(2);
    expect(model.totalLeads).toBe(2);
    expect(model.recordOmissions.risks).toBe(2);
  });

  it("shows a viewer the totals of exactly the granted groups", () => {
    expect(
      read(session({ viewerGroupAccess: [GROUP_B] })).recordOmissions,
    ).toEqual({ risks: 5, decisions: 0, unknown: false });
    expect(
      read(session({ viewerGroupAccess: [GROUP_A, GROUP_B] })).recordOmissions,
    ).toEqual({ risks: 7, decisions: 0, unknown: false });
  });

  it("discloses nothing to a viewer without a matching grant", () => {
    for (const viewerGroupAccess of [[], [GROUP_C]]) {
      expect(() => read(session({ viewerGroupAccess }))).toThrow(
        /indexed section scope does not match the snapshot/,
      );
    }
  });

  it("shows an admin every section's totals", () => {
    expect(read(session({ role: "admin" })).recordOmissions).toEqual({
      risks: 7,
      decisions: 0,
      unknown: false,
    });
  });
});
