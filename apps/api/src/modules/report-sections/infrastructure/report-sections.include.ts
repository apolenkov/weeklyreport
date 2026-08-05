import { Prisma } from "@prisma/client";

/**
 * Shared Prisma include constant for the full ReportSection aggregate.
 * Loads 5 nested relations: author, projectStatuses+project, items, risks, decisions.
 *
 * 35-03/04: also loads `author.role` (so the read model can carry
 * `authorRole`) and the project's stage assignments scoped to the
 * section author (so each project's `ownedStages[]` can be derived
 * without a second round-trip).
 *
 * fix-lead-surface-name-resolution: items/risks/decisions also ride their
 * `project.name` so the read model can emit name-only `referencedProjects`
 * for rows referencing a project the author owns no stage on — without a
 * second query and without widening `projects` (which drives product
 * cards, ProjectStatus writes, and submit validation).
 */
export const reportSectionFullInclude = {
  // This constant is the SINGLE contract every report-section read shares.
  // `mapPrismaToReportSection`'s parameter type is derived from it below
  // (`Prisma.ReportSectionGetPayload`) — a query change here changes that
  // type for every consumer automatically.
  author: {
    select: {
      name: true,
      role: true,
      id: true,
      // review-acknowledgement: the section author's reporting group. The
      // weekly-report live read stamps it onto the read model so the client can
      // gate reviewer affordances and the Acknowledge control per group.
      reportingGroupId: true,
      stageAssignments: {
        include: {
          // unassigned-stage-reporting-exclusion: include the product's FULL
          // assignment set (across all leads, with each stage) so the read
          // model can expose the per-product `stageSet` — the union needed to
          // tell a vacant stage (excluded) from a foreign-owned one. Display
          // metadata only; the writable `ownedStages` stays the author's own
          // assignments.
          project: {
            include: {
              stageAssignments: {
                include: { stage: true },
              },
              // The product's natural owner group — its lead's reporting group.
              // Frozen onto each `projects[]` entry so the published-snapshot
              // read can decide cross-group access from the snapshot's own data
              // rather than a live re-query.
              lead: { select: { reportingGroupId: true } },
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
  // Project Activity weekly statuses — seeded section child rows with the
  // activity's display name joined so the read model can emit `activities`
  // without a second query.
  activityStatuses: {
    include: {
      activity: {
        select: {
          name: true,
          // activity-first-class: the activity's label-only product links, so
          // the read model can emit `linkedProducts` (id + name) inline.
          activityProducts: {
            select: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
  // review-acknowledgement: per-record reviewer comments and per-section
  // verdicts ride the full aggregate so the lead / reviewer read surfaces them
  // (mapped into `comments` / `reviews`). `reviewer.name` rides along for
  // display; verdict staleness (`isCurrent`) is derived in the mapper from
  // `judgedVersion` vs the section `version`.
  items: {
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  },
  risks: {
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  },
  decisions: {
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  },
  sectionReviews: {
    include: { reviewer: { select: { name: true } } },
  },
} as const satisfies Prisma.ReportSectionInclude;

/**
 * The report-section mapper's input, generated directly from
 * `reportSectionFullInclude` — never a hand-written mirror. A query change
 * here changes this type (and every real call site) together; nothing to
 * keep in sync by hand.
 */
export type PrismaReportSectionWithRelations = Prisma.ReportSectionGetPayload<{
  include: typeof reportSectionFullInclude;
}>;

// review-acknowledgement: comment/review row shapes derived by indexed access
// from the generated payload — never hand-mirrored, so they can't drift from
// the include above.
export type RecordCommentRow =
  PrismaReportSectionWithRelations["items"][number]["recordComments"][number];
export type SectionReviewRow =
  PrismaReportSectionWithRelations["sectionReviews"][number];
