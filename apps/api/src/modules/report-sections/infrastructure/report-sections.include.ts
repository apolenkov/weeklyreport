import { Prisma } from "@prisma/client";

// Single include contract for every report-section read; type is derived from it.
export const reportSectionFullInclude = {
  author: {
    select: {
      name: true,
      role: true,
      id: true,
      // Live read stamps group for reviewer affordances / Acknowledge gating.
      reportingGroupId: true,
      stageAssignments: {
        include: {
          // Full cross-lead stageSet (display); ownedStages stays author-only.
          project: {
            include: {
              stageAssignments: {
                include: { stage: true },
              },
              // Product ownership is an explicit one-group edge. The mapper
              // rejects missing or duplicate edges before freezing a snapshot.
              groupProducts: { select: { groupId: true } },
            },
          },
          stage: true,
        },
      },
    },
  },
  projectStatuses: {
    include: {
      project: true,
    },
  },
  stageStatuses: {
    include: { stage: true },
  },
  // Activity statuses + name + linkedProducts in one query.
  activityStatuses: {
    include: {
      activity: {
        select: {
          name: true,
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
