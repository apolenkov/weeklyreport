// Row builders for the mapper and repository suites. Shared rather than copied
// because a fabricated row must stay identical across both to be worth
// asserting on.
import type { PrismaReportSectionWithRelations } from "@customreport/report-persistence";
import { mapPrismaToReportSection } from "@customreport/report-persistence";
import type { TrafficLightStatus } from "@customreport/shared";

export const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
export const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
export const OWNED_PROJECT = "44444444-4444-4444-8444-444444444444";
export const UNOWNED_PROJECT = "55555555-5555-4555-8555-555555555555";
export const STAGE_ID = "66666666-6666-4666-8666-666666666666";
export const TESTING_STAGE_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
export const OWNER_GROUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export type FabricatedRow = Pick<
  PrismaReportSectionWithRelations,
  | "author"
  | "projectStatuses"
  | "stageStatuses"
  | "items"
  | "risks"
  | "decisions"
  | "activityStatuses"
  | "sectionReviews"
  | "itemOutcomeEvents"
> & {
  id: string;
  reportId: string;
  authorId: string;
  status: string;
  submittedAt: Date | null;
  late: boolean;
  version: number;
};

// Full scalar defaults for Prisma payload fixtures.
export const FIXED_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

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

export function fullCrossLeadAssignment(
  id: string,
  name: string,
  sortOrder: number,
) {
  return {
    id: `${id}-assignment`,
    userId: AUTHOR_ID,
    stageId: id,
    projectId: OWNED_PROJECT,
    createdAt: FIXED_TIMESTAMP,
    stage: fullStage(id, name, sortOrder),
  };
}

export function fullOwnedStageAssignment(
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
      groupProducts: [{ groupId: OWNER_GROUP_ID }],
    },
    stage: fullStage(STAGE_ID, "Development", 4),
  };
}

export function baseRow(overrides: Partial<FabricatedRow> = {}): FabricatedRow {
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
    itemOutcomeEvents: [],
    ...overrides,
  };
}

export function mapRow(row: FabricatedRow) {
  return mapPrismaToReportSection(
    row as unknown as PrismaReportSectionWithRelations,
  );
}

export function fullProjectStatus(overrides: {
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

export function fullItem(
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
    pausedReason: string | null;
    nextStepText: string | null;
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
    pausedReason: overrides.pausedReason ?? null,
    nextStepText: overrides.nextStepText ?? null,
    resolution: null,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    stageNames: overrides.stageNames ?? [],
    project: overrides.project ?? null,
    recordComments: [],
  };
}

export function fullRisk(
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

export function fullDecision(
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
