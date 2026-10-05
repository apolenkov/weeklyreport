import type { Prisma } from "@prisma/client";

// Single include contract for every report-section read; type is derived from it.
export const reportSectionFullInclude = {
  author: {
    select: {
      name: true,
      role: true,
      id: true,
      // Live read stamps group for reviewer affordances / Acknowledge gating.
      reportingGroupId: true,
      // Only what the section mapper reads: no whole Project/Stage rows.
      stageAssignments: {
        select: {
          projectId: true,
          stageId: true,
          stage: { select: { name: true, sortOrder: true } },
          project: {
            select: {
              id: true,
              name: true,
              archived: true,
              // Full cross-lead stageSet (display); ownedStages stays author-only.
              stageAssignments: {
                select: {
                  stageId: true,
                  stage: { select: { name: true, sortOrder: true } },
                },
              },
              groupProducts: { select: { groupId: true } },
            },
          },
        },
      },
    },
  },
  projectStatuses: {
    select: { projectId: true, status: true, updatedAt: true },
  },
  stageStatuses: {
    select: { projectId: true, stageId: true, status: true, updatedAt: true },
  },
  // Activity statuses + name + linkedProducts in one query.
  activityStatuses: {
    include: {
      activity: {
        select: {
          name: true,
          jiraAccounts: true,
          activityProducts: {
            select: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
  // Comments/reviews ride the aggregate; isCurrent derived in mapper.
  items: {
    orderBy: { stableId: "asc" },
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
  },
  risks: {
    orderBy: { stableId: "asc" },
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
  },
  decisions: {
    orderBy: { stableId: "asc" },
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
  },
  sectionReviews: {
    include: { reviewer: { select: { name: true } } },
  },
  itemOutcomeEvents: {
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  },
} as const satisfies Prisma.ReportSectionInclude;

export type PrismaReportSectionWithRelations = Prisma.ReportSectionGetPayload<{
  include: typeof reportSectionFullInclude;
}>;

// Comment/review row shapes derived by indexed access from the generated
// payload — never hand-mirrored, so they can't drift from the include above.
export type RecordCommentRow =
  PrismaReportSectionWithRelations["items"][number]["recordComments"][number];
export type SectionReviewRow =
  PrismaReportSectionWithRelations["sectionReviews"][number];
