import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type TrafficLightStatus,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import { queryPublishedLineage } from "../application/published-lineage";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  SectionVersionConflictError,
} from "../application/report-sections.service";

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
  },
  risks: {
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
  },
  decisions: {
    include: {
      project: { select: { name: true } },
      recordComments: { include: { reviewer: { select: { name: true } } } },
    },
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
type RecordCommentRow =
  PrismaReportSectionWithRelations["items"][number]["recordComments"][number];
type SectionReviewRow =
  PrismaReportSectionWithRelations["sectionReviews"][number];

/** Worst-case severity rank for the per-project traffic-light aggregation (any red stage wins). */
const TRAFFIC_LIGHT_RED_SEVERITY = 3;

function aggregateStageTraffic(
  stages: { status?: string | null }[],
): string | null {
  // eslint-disable-next-line no-restricted-syntax -- Loop-carried severity preserves the first red-stage short-circuit; a reduce would keep scanning after the terminal state.
  let severity = 0;
  for (const stage of stages) {
    if (stage.status === "red") {
      severity = TRAFFIC_LIGHT_RED_SEVERITY;
      break;
    }
    if (stage.status === "yellow") severity = Math.max(severity, 2);
    if (stage.status === "green") severity = Math.max(severity, 1);
  }
  return severity === TRAFFIC_LIGHT_RED_SEVERITY
    ? "red"
    : severity === 2
      ? "yellow"
      : severity === 1
        ? "green"
        : null;
}

type TrafficLight = TrafficLightStatus;

const TRAFFIC_SEVERITY: Record<TrafficLight, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

/**
 * fix-published-empty-stage-risk-floor (D5 option a): the API restatement of
 * the `riskCoversStage` covers-all rule. The web helper
 * (`apps/web/src/components/lead/stage-tags.ts`) lives behind the app boundary
 * and carries a `"use client"` React import, so it cannot be imported here.
 *
 * `stageIds` is a misnomer — it holds stage NAMES, not UUIDs. An empty/absent
 * array means "covers every stage the author owns on this product"; a populated
 * array covers only the named stages.
 */
function riskCoversStageName(
  risk: { stageIds?: readonly string[] },
  stageName: string,
): boolean {
  if (!risk.stageIds || risk.stageIds.length === 0) return true;
  return risk.stageIds.includes(stageName);
}

function severityToTraffic(severity: string | undefined): TrafficLight | null {
  if (severity === "blocked") return "red";
  if (severity === "at-risk") return "yellow";
  return null;
}

function asTraffic(status: string | null | undefined): TrafficLight | null {
  return status === "green" || status === "yellow" || status === "red"
    ? status
    : null;
}

function worseTraffic(
  a: TrafficLight | null,
  b: TrafficLight | null,
): TrafficLight | null {
  if (a === null) return b;
  if (b === null) return a;
  return TRAFFIC_SEVERITY[a] >= TRAFFIC_SEVERITY[b] ? a : b;
}

/**
 * fix-published-empty-stage-risk-floor: derives the risk-aware effective
 * product status at the READ layer. For each owned stage, the effective status
 * is the worse of the raw stage status and the highest-severity own risk that
 * covers it. The product status is the worst across owned stages, floored
 * against the raw `trafficLight` so the floor never lowers (a real red
 * ProjectStatus survives a milder risk) and double-application stays
 * idempotent.
 *
 * CRITICAL: risks MUST be scoped to the product (`risk.projectId === projectId`)
 * BEFORE the per-stage match. `riskCoversStageName` matches stage NAME only and
 * the 7 SDLC stage names are shared across every product, so an unscoped fold
 * would floor the wrong product (and a covers-all risk every product). This
 * mirrors the `buildStageGrid` call site, which pre-filters by `projectId`.
 *
 * Per D4 this is aggregation-only: it never writes back to the raw persisted
 * `StageStatus.status` nor to the read-model per-stage `status` field. A product
 * with no owned stages contributes nothing to floor (covers-all means "all
 * stages the author owns on THIS product"), so the raw `trafficLight` passes
 * through unchanged.
 */
export function deriveEffectiveProductStatus(project: {
  projectId: string;
  trafficLight: TrafficLight | null;
  ownedStages?: readonly {
    stageName: string;
    status?: string | null;
  }[];
  risks?: readonly {
    // Nullable/optional: an activity-parented risk carries no product FK — it
    // never matches a product's projectId below, so it cannot floor product
    // health. `undefined` tolerated for read-model risks (optional field).
    projectId?: string | null;
    severity?: string;
    stageIds?: readonly string[];
  }[];
}): TrafficLight | null {
  const scopedRisks = (project.risks ?? []).filter(
    (risk) => risk.projectId === project.projectId,
  );

  return (project.ownedStages ?? []).reduce<TrafficLight | null>(
    (effective, stage) => {
      const coveringSeverity = scopedRisks
        .filter((risk) => riskCoversStageName(risk, stage.stageName))
        .reduce<TrafficLight | null>(
          (acc, risk) => worseTraffic(acc, severityToTraffic(risk.severity)),
          null,
        );
      const stageEffective = worseTraffic(
        asTraffic(stage.status),
        coveringSeverity,
      );
      return worseTraffic(effective, stageEffective);
    },
    project.trafficLight,
  );
}

/**
 * activity-first-class (design decision 5): the activity pill's status floor.
 * An activity has no SDLC stage, so it is floored by its OWN risks only — a
 * `blocked` risk forces red, an `at-risk` risk forces at least yellow. Items
 * carry progress, never an alarm (rework-item-status-model), so they cannot
 * floor the pill. `alarmFloor` is that RECORD-ONLY floor (never the lead's
 * stored choice); `derivedStatus` folds the stored status in for the read-only
 * render surfaces (slides, head report). The stored `ActivityStatus.status` is
 * NEVER rewritten. The interactive lead picker gates a manual lower on
 * `alarmFloor` alone, so a lead can still lower a status they raised themselves
 * when no covering risk/blocker holds it up.
 */
function deriveActivityStatus(
  stored: TrafficLight | null,
  ownRisks: readonly { severity: string }[],
): { derivedStatus: TrafficLight | null; alarmFloor: TrafficLight | null } {
  const alarmFloor = ownRisks.reduce<TrafficLight | null>(
    (acc, risk) =>
      worseTraffic(
        acc,
        severityToTraffic(risk.severity === "blocked" ? "blocked" : "at-risk"),
      ),
    null,
  );
  return { derivedStatus: worseTraffic(stored, alarmFloor), alarmFloor };
}

// review-acknowledgement: project the joined RecordComment rows onto the
// read-model comment view (flat; reviewer display name rides along).
function toCommentViews(comments: readonly RecordCommentRow[]) {
  return comments.map((comment) => ({
    id: comment.id,
    reviewerId: comment.reviewerId,
    reviewerName: comment.reviewer.name,
    text: comment.text,
    createdAt: comment.createdAt,
  }));
}

// review-acknowledgement: project section verdicts onto the read-model view.
// A verdict is CURRENT only while it judged the section's current version — a
// re-submission bumps `version` and auto-stales any prior verdict, no clearing.
function toReviewViews(
  reviews: readonly SectionReviewRow[],
  sectionVersion: number,
) {
  return reviews.map((review) => ({
    reviewerId: review.reviewerId,
    reviewerName: review.reviewer.name,
    verdict: review.verdict === "approved" ? "approved" : "changes_requested",
    judgedVersion: review.judgedVersion,
    isCurrent: review.judgedVersion === sectionVersion,
    createdAt: review.createdAt,
  }));
}

/**
 * Maps a Prisma ReportSection with all relations to the domain ReportSectionReadModel.
 * Field names are mapped from Prisma conventions to Zod schema conventions.
 */
export function mapPrismaToReportSection(
  row: PrismaReportSectionWithRelations,
): ReportSectionReadModel {
  const projectStatusByProjectId = new Map(
    row.projectStatuses.map((ps) => [ps.projectId, ps.status] as const),
  );
  const stageStatusByKey = new Map(
    row.stageStatuses.map(
      (ss) => [`${ss.projectId}::${ss.stageId}`, ss.status] as const,
    ),
  );
  const assignmentsByProjectId = new Map<
    string,
    {
      // Carries `stageAssignments` (the product's full cross-lead set) so the
      // per-product `stageSet` can be derived below.
      project: (typeof row.author.stageAssignments)[number]["project"];
      assignments: typeof row.author.stageAssignments;
    }
  >();

  for (const assignment of row.author.stageAssignments) {
    if (assignment.project.archived) continue;
    const current = assignmentsByProjectId.get(assignment.projectId);
    if (current) {
      current.assignments.push(assignment);
    } else {
      assignmentsByProjectId.set(assignment.projectId, {
        project: assignment.project,
        assignments: [assignment],
      });
    }
  }

  // fix-lead-surface-name-resolution: name-only entries for projects that
  // items/risks/decisions reference but the author owns no stage on, so
  // the lead-surface mappers can resolve the real product name instead of
  // "Unknown"/"Group". Names ride the row's `project` relation (no extra
  // query). Stage-owned projects are excluded — they already carry their
  // name in `projects` and win on conflict (design Decision 3). Archived
  // referenced projects resolve too (design Open Question 2): the name is
  // not secret and a placeholder would misread as data loss.
  const referencedNamesById = new Map<string, string>();
  const referencedRows = [
    ...row.items.map((i) => ({ projectId: i.projectId, project: i.project })),
    ...row.risks.map((r) => ({ projectId: r.projectId, project: r.project })),
    ...row.decisions.map((d) => ({
      projectId: d.productId,
      project: d.project,
    })),
  ];
  for (const { projectId, project } of referencedRows) {
    if (!projectId || !project?.name) continue;
    if (assignmentsByProjectId.has(projectId)) continue;
    referencedNamesById.set(projectId, project.name);
  }
  const referencedProjects = [...referencedNamesById.entries()]
    .map(([projectId, projectName]) => ({ projectId, projectName }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru"));

  return reportSectionReadModelSchema.parse({
    reportSectionId: row.id,
    reportId: row.reportId,
    authorId: row.authorId,
    authorName: row.author.name,
    // 35-03: surface the section author's system role end-to-end so the
    // /lead/report chrome can switch between Request Reopen (lead) and
    // Revoke (head/admin viewing this lead's section).
    authorRole: row.author.role,
    // Optimistic-concurrency row revision the client echoes back on its next
    // save; every section read carries the current value.
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt,
    // late flag stamped by submitSection when `now > Report.deadline` at
    // submit-time.
    late: row.late,
    projects: [...assignmentsByProjectId.values()]
      .map(({ project, assignments }) => {
        const ownedStages = assignments
          .map((sa) => ({
            stageId: sa.stageId,
            stageName: sa.stage.name,
            sortOrder: sa.stage.sortOrder,
            status:
              stageStatusByKey.get(`${project.id}::${sa.stageId}`) ?? null,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        // unassigned-stage-reporting-exclusion: the product's assigned-stage
        // set — every stage with an assignment to ANY lead on the product,
        // deduped by stageId and ordered by pipeline sortOrder. READ-ONLY
        // display metadata; the lead-form grid renders only stages in this set
        // (a vacant stage is excluded). The writable `ownedStages` is untouched.
        const stageSet = [
          ...new Map(
            project.stageAssignments.map(
              (sa) =>
                [
                  sa.stageId,
                  {
                    stageId: sa.stageId,
                    stageName: sa.stage.name,
                    sortOrder: sa.stage.sortOrder,
                  },
                ] as const,
            ),
          ).values(),
        ].sort((a, b) => a.sortOrder - b.sortOrder);

        const rawTrafficLight =
          aggregateStageTraffic(ownedStages) ??
          projectStatusByProjectId.get(project.id) ??
          null;

        return {
          projectId: project.id,
          projectName: project.name,
          // fix-published-empty-stage-risk-floor: floor the product status by
          // the author's own covering risks (scoped to this product) so an
          // owned stage with no submitted status covered by a blocked/at-risk
          // risk reads red/yellow. Raw `ownedStages[].status` is left untouched
          // (D4); only this derived product-level status is floored.
          trafficLight: deriveEffectiveProductStatus({
            projectId: project.id,
            trafficLight: asTraffic(rawTrafficLight),
            ownedStages,
            risks: row.risks.map((r) => ({
              projectId: r.projectId,
              severity: r.severity === "blocked" ? "blocked" : "at-risk",
              stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
            })),
          }),
          ownedStages,
          stageSet,
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru")),
    referencedProjects,
    items: row.items.map((i) => ({
      id: i.id,
      // Durable lineage key — surfaced so the client round-trips it back and
      // saveSection's recreate preserves it instead of re-minting.
      stableId: i.stableId,
      // XOR parent — exactly one is non-null; both flat on the top-level array,
      // discriminated by which FK is set (activity rows carry `activityId`).
      projectId: i.projectId,
      activityId: i.activityId,
      type: i.type,
      text: i.text,
      tag: i.tag,
      workflowStatus: i.workflowStatus,
      carriedOver: i.carriedOver,
      priorityRank: i.priorityRank ?? null,
      pausedReason: i.pausedReason ?? null,
      stageIds: i.stageNames.length > 0 ? i.stageNames : undefined,
      comments: toCommentViews(i.recordComments),
    })),
    risks: row.risks.map((r) => ({
      id: r.id,
      stableId: r.stableId,
      // XOR parent (see items above).
      projectId: r.projectId,
      activityId: r.activityId,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      severity: r.severity === "blocked" ? "blocked" : "at-risk",
      stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
      comments: toCommentViews(r.recordComments),
    })),
    decisions: row.decisions.map((d) => ({
      id: d.id,
      stableId: d.stableId,
      text: d.text,
      owner: d.owner,
      deadline: d.deadline,
      impact: d.impact,
      resolvedAt: d.resolvedAt,
      stageIds: d.stageNames.length > 0 ? d.stageNames : undefined,
      // XOR parent (full parity — an activity owns decisions too).
      productId: d.productId ?? undefined,
      activityId: d.activityId ?? undefined,
      comments: toCommentViews(d.recordComments),
    })),
    // Every seeded activity status, name joined, name-sorted. Seeding already
    // excludes archived activities; a row seeded before a mid-period archive
    // stays listed so the delete-recreate save never silently drops it.
    // activity-first-class: each row carries its label-only `linkedProducts` and
    // the risk/blocker-derived status floor (design decision 5).
    activities: row.activityStatuses
      .map((status) => ({
        activityId: status.activityId,
        activityName: status.activity.name,
        status: asTraffic(status.status),
        note: status.note,
        linkedProducts: status.activity.activityProducts
          .map((link) => ({
            productId: link.product.id,
            productName: link.product.name,
          }))
          .sort((a, b) => a.productName.localeCompare(b.productName, "ru")),
        ...deriveActivityStatus(
          asTraffic(status.status),
          row.risks.filter((r) => r.activityId === status.activityId),
        ),
      }))
      .sort((a, b) => a.activityName.localeCompare(b.activityName, "ru")),
    reviews: toReviewViews(row.sectionReviews, row.version),
  });
}

// review-acknowledgement: a reviewer comment lifted out of the DB just before
// saveSection delete-recreates its anchor record, keyed by the record's DURABLE
// lineage (stableId + kind) rather than the volatile PK that the recreate
// re-mints. Re-inserted against the new PK for every lineage that survives the
// save — see the comment-transfer note on saveSection.
type RecordKind = "item" | "risk" | "decision";
interface CapturedComment {
  stableId: string;
  kind: RecordKind;
  reviewerId: string;
  text: string;
  createdAt: Date;
}

const lineageKey = (kind: RecordKind, stableId: string): string =>
  `${kind}::${stableId}`;

/**
 * Read every RecordComment anchored to a record in this section, tagged with
 * its anchor's `stableId` + kind, BEFORE the child rows are deleted (the
 * delete cascades the comments away). One join per anchor kind; exactly one
 * relation is set per comment.
 */
async function captureRecordComments(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<CapturedComment[]> {
  const comments = await tx.recordComment.findMany({
    where: {
      OR: [
        { item: { reportSectionId: sectionId } },
        { risk: { reportSectionId: sectionId } },
        { decision: { reportSectionId: sectionId } },
      ],
    },
    select: {
      reviewerId: true,
      text: true,
      createdAt: true,
      item: { select: { stableId: true } },
      risk: { select: { stableId: true } },
      decision: { select: { stableId: true } },
    },
  });

  return comments.flatMap((comment) => {
    const anchor = comment.item
      ? ({ kind: "item", stableId: comment.item.stableId } as const)
      : comment.risk
        ? ({ kind: "risk", stableId: comment.risk.stableId } as const)
        : comment.decision
          ? ({ kind: "decision", stableId: comment.decision.stableId } as const)
          : null;
    if (!anchor) return [];
    return [
      {
        stableId: anchor.stableId,
        kind: anchor.kind,
        reviewerId: comment.reviewerId,
        text: comment.text,
        createdAt: comment.createdAt,
      },
    ];
  });
}

/**
 * Re-anchor captured comments onto the freshly recreated records. Records are
 * matched by lineage (stableId + kind); a comment whose lineage is gone (its
 * record was dropped from the payload this save) is NOT re-inserted, so it
 * hard-dies exactly when the record it flagged is genuinely removed. Runs
 * inside saveSection's transaction, so it is atomic with the version bump.
 */
async function reinsertRecordComments(
  tx: Prisma.TransactionClient,
  sectionId: string,
  captured: readonly CapturedComment[],
): Promise<void> {
  if (captured.length === 0) return;

  const [items, risks, decisions] = await Promise.all([
    tx.item.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
    tx.risk.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
    tx.decision.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
  ]);

  const idByLineage = new Map<string, string>();
  for (const row of items)
    idByLineage.set(lineageKey("item", row.stableId), row.id);
  for (const row of risks)
    idByLineage.set(lineageKey("risk", row.stableId), row.id);
  for (const row of decisions)
    idByLineage.set(lineageKey("decision", row.stableId), row.id);

  const data = captured.flatMap((comment) => {
    const newRecordId = idByLineage.get(
      lineageKey(comment.kind, comment.stableId),
    );
    if (newRecordId === undefined) return [];
    return [
      {
        reviewerId: comment.reviewerId,
        text: comment.text,
        // Preserve the original authoring timestamp across the recreate.
        createdAt: comment.createdAt,
        itemId: comment.kind === "item" ? newRecordId : null,
        riskId: comment.kind === "risk" ? newRecordId : null,
        decisionId: comment.kind === "decision" ? newRecordId : null,
      },
    ];
  });

  if (data.length > 0) await tx.recordComment.createMany({ data });
}

@Injectable()
export class ReportSectionsPrismaRepository
  implements ReportSectionsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async getReportStatus(reportId: string): Promise<string | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    return report?.status ?? null;
  }

  /**
   * Deadline-aware report lookup used by the submitSection grace-period gate.
   * Returns null when the report does not exist so the service can no-op the
   * gate without ad-hoc try/catch.
   */
  async getReportMeta(
    reportId: string,
  ): Promise<{ status: string; deadline: Date } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, deadline: true },
    });

    return report ?? null;
  }

  async getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: reportSectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row);
  }

  /**
   * Published lineage of the section's CURRENT rows (items + decisions) — the
   * resolve-not-delete lock's reference set. Delegates to
   * `queryPublishedLineage`, which unions the own report's frozen
   * `publishedSnapshot` (the reopened-period case) with live rows in other
   * frozen published/archived reports (the carried-clone case).
   */
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }> {
    return queryPublishedLineage(this.prisma, {
      reportId: section.reportId,
      reportSectionId: section.reportSectionId,
      itemStableIds: section.items.flatMap((item) =>
        item.stableId ? [item.stableId] : [],
      ),
      decisionStableIds: section.decisions.flatMap((decision) =>
        decision.stableId ? [decision.stableId] : [],
      ),
    });
  }

  async saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel> {
    const sectionId = section.reportSectionId;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Optimistic-concurrency compare-and-set, FIRST so a conflict aborts
          // before any deleteMany runs (no child rows are touched on conflict).
          // `expectedVersion` is the client-loaded version threaded through the
          // payload — NOT the freshly-fetched row's — so a stale writer whose
          // row was advanced concurrently matches zero rows and 409s.
          const updated = await tx.reportSection.updateMany({
            where: { id: sectionId, version: expectedVersion },
            data: {
              status: section.status,
              submittedAt: section.submittedAt,
              // Persist the late flag computed by submitSection; saveDraft /
              // reopen paths carry the prior value through mergeSection.
              late: section.late,
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            throw new SectionVersionConflictError(
              "This section was changed by another save. Reload and try again.",
            );
          }

          // review-acknowledgement (comment-aware save): lift reviewer comments
          // out before the child delete-recreate cascades them away, keyed by
          // the record's durable lineage (stableId + kind), then re-anchor the
          // survivors below. A comment whose record is dropped from this payload
          // is NOT re-inserted → it hard-dies with the record it flagged.
          const capturedComments = await captureRecordComments(tx, sectionId);

          await tx.projectStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.stageStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.activityStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.decision.deleteMany({
            where: { reportSectionId: sectionId },
          });

          const projectData = section.projects.map((p) => ({
            reportSectionId: sectionId,
            projectId: p.projectId,
            status: p.trafficLight,
          }));

          if (projectData.length > 0) {
            await tx.projectStatus.createMany({ data: projectData });
          }

          const stageStatusData = section.projects.flatMap((project) =>
            (project.ownedStages ?? []).map((stage) => ({
              reportSectionId: sectionId,
              projectId: project.projectId,
              stageId: stage.stageId,
              status: stage.status ?? null,
            })),
          );

          if (stageStatusData.length > 0) {
            await tx.stageStatus.createMany({ data: stageStatusData });
          }

          // Mirror ProjectStatus: recreate the activity slice from the merged
          // read model. Every id here came from the seeded server-side set —
          // mergeSection folds client statuses onto section.activities and the
          // service rejects any unattached activityId before this runs.
          const activityStatusData = section.activities.map((activity) => ({
            reportSectionId: sectionId,
            activityId: activity.activityId,
            status: activity.status,
            note: activity.note ?? null,
          }));

          if (activityStatusData.length > 0) {
            await tx.activityStatus.createMany({ data: activityStatusData });
          }

          if (section.items.length > 0) {
            await tx.item.createMany({
              data: section.items.map((i) => ({
                // The DB mints the id — rows are recreated wholesale, so trusting
                // a client-supplied PK only risks a cross-section P2002 collision.
                reportSectionId: sectionId,
                // Preserve the durable lineage key through the recreate. Undefined
                // for a brand-new record → omitted so the `@default(uuid())` mints
                // one; never `?? null` (the column is NOT NULL).
                stableId: i.stableId,
                // XOR parent: product-parented rows write projectId; activity-
                // parented rows write activityId (product FK null). The hand-written
                // CHECK is the backstop; the write schema already enforced XOR.
                projectId: i.projectId ?? null,
                activityId: i.activityId ?? null,
                type: i.type,
                text: i.text,
                tag: i.tag,
                workflowStatus: i.workflowStatus,
                carriedOver: i.carriedOver,
                priorityRank: i.priorityRank ?? null,
                pausedReason: i.pausedReason ?? null,
                stageNames: i.stageIds ?? [],
              })),
            });
          }

          if (section.risks.length > 0) {
            await tx.risk.createMany({
              data: section.risks.map((r) => ({
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: r.stableId,
                // XOR parent (see items above).
                projectId: r.projectId ?? null,
                activityId: r.activityId ?? null,
                risk: r.risk,
                impact: r.impact,
                mitigation: r.mitigation,
                severity: r.severity ?? "at-risk",
                stageNames: r.stageIds ?? [],
              })),
            });
          }

          // activity-first-class (Decision 6): persist a decision parented by
          // EITHER a product OR an activity (the write schema's XOR guarantees
          // exactly one). The old productId-only filter silently dropped every
          // activity-parented decision.
          const decisionsToSave = section.decisions.filter(
            (d) => d.productId != null || d.activityId != null,
          );
          if (decisionsToSave.length > 0) {
            await tx.decision.createMany({
              data: decisionsToSave.map((d) => ({
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: d.stableId,
                text: d.text,
                owner: d.owner,
                deadline: d.deadline ?? null,
                impact: d.impact,
                resolvedAt: d.resolvedAt ?? null,
                stageNames: d.stageIds ?? [],
                // XOR parent (product FK null for the activity case).
                productId: d.productId ?? null,
                activityId: d.activityId ?? null,
              })),
            });
          }

          // Re-anchor the captured comments onto the recreated records (matched
          // by lineage). Atomic with the version bump above.
          await reinsertRecordComments(tx, sectionId, capturedComments);

          // Re-read INSIDE this still-open transaction (read-your-own-writes),
          // not after it commits. The
          // compare-and-set above already holds this transaction's row lock
          // on THIS ReportSection; a concurrent report delete's cascade needs
          // that same row lock to proceed and blocks until this transaction
          // finishes — so there is no longer a post-commit gap for a delete
          // to land in.
          const saved = await tx.reportSection.findUnique({
            where: { id: sectionId },
            include: reportSectionFullInclude,
          });

          if (!saved) {
            // Defensive only: this transaction holds the row lock it just
            // used for the compare-and-set, so a real DB should never reach
            // this branch.
            throw new SectionVersionConflictError(
              "This section was changed by another save. Reload and try again.",
            );
          }

          return mapPrismaToReportSection(saved);
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      if (error instanceof SectionVersionConflictError) {
        throw error;
      }
      // The DB mints child ids now, but a duplicate (reportSectionId, projectId)
      // ProjectStatus (or any other unique violation) in a malformed payload can
      // still trip P2002 — surface it as a clean 400, never an unhandled 500.
      if (isUniqueViolation(error)) {
        throw new ReportSectionDomainError(
          "DUPLICATE_CHILD_ROW",
          "Could not save the section: a duplicate row was rejected.",
        );
      }
      throw error;
    }
  }
}
