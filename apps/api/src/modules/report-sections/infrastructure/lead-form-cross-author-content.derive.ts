import {
  type DbRole,
  itemWorkflowStatusSchema,
  riskSeveritySchema,
} from "@weeklyreport/shared";

import type { CrossAuthorSectionRow } from "../domain/lead-form-shared";
import {
  deriveForeignStageStatus,
  type StageTrafficStatus,
} from "./lead-form-cross-author.derive.js";
import { indexNonNullStageStatuses } from "./non-null-stage-status-index.derive.js";

// A co-owner's stage assignment on a shared, non-archived product.
interface CrossAuthorStageAssignment {
  readonly projectId: string;
  readonly stageId: string;
  readonly stageName: string;
}

// Per-author scoping entry for the content read.
interface CrossAuthorEntry {
  readonly authorId: string;
  readonly authorName: string;
  readonly authorRole: DbRole;
  readonly sharedProjectIds: ReadonlySet<string>;
  readonly stageAssignments: readonly CrossAuthorStageAssignment[];
}

// Row of foreign stage assignments the content read groups over.
interface ForeignContentAssignmentRow {
  readonly projectId: string;
  readonly stageId: string;
  readonly stage: { name: string };
  readonly user: { id: string; name: string; role: DbRole };
}

// `coOwnsShared` is the authorization signal: `others` only ever holds stage
// assignments on shared, non-archived products, so a non-empty grouping means
// the caller co-owns at least one.
export function groupCrossAuthorAuthors(
  others: readonly ForeignContentAssignmentRow[],
): {
  authorEntries: Map<string, CrossAuthorEntry>;
  coOwnsShared: boolean;
  otherUserIds: string[];
} {
  const authorEntries = new Map<string, CrossAuthorEntry>(
    [...Map.groupBy(others, (row) => row.user.id)].flatMap(([userId, rows]) => {
      const [head] = rows;
      if (!head) return [];
      return [
        [
          userId,
          {
            authorId: head.user.id,
            authorName: head.user.name,
            authorRole: head.user.role,
            sharedProjectIds: new Set(rows.map((r) => r.projectId)),
            stageAssignments: rows.map((r) => ({
              projectId: r.projectId,
              stageId: r.stageId,
              stageName: r.stage.name,
            })),
          },
        ] as const,
      ];
    }),
  );

  return {
    authorEntries,
    coOwnsShared: authorEntries.size > 0,
    otherUserIds: [...authorEntries.keys()],
  };
}

// Foreign section shape for the full-content cross-author read.
interface ForeignContentSection {
  readonly authorId: string;
  readonly items: readonly {
    id: string;
    projectId: string | null;
    type: string;
    text: string;
    tag: string;
    workflowStatus: string;
    carriedOver: boolean;
    priorityRank: number | null;
    stageNames: string[];
  }[];
  readonly risks: readonly {
    id: string;
    projectId: string | null;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
  }[];
  readonly decisions: readonly {
    id: string;
    productId: string | null;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageNames: string[];
  }[];
  readonly stageStatuses: readonly {
    projectId: string;
    stageId: string;
    status: StageTrafficStatus;
  }[];
}

function selectSharedItems(
  items: ForeignContentSection["items"],
  sharedIds: ReadonlySet<string>,
): CrossAuthorSectionRow["items"] {
  return items
    .filter(
      (item): item is typeof item & { projectId: string } =>
        item.projectId !== null && sharedIds.has(item.projectId),
    )
    .map((item) => ({
      ...item,
      workflowStatus: itemWorkflowStatusSchema.parse(item.workflowStatus),
    }));
}

export function buildCrossAuthorContentRows(
  sections: readonly ForeignContentSection[],
  authorEntries: ReadonlyMap<string, CrossAuthorEntry>,
): CrossAuthorSectionRow[] {
  return sections.flatMap((section) => {
    const authorEntry = authorEntries.get(section.authorId);
    if (!authorEntry) return [];
    const sharedIds = authorEntry.sharedProjectIds;

    // Foreign chips are risk-derived; persisted status is only the empty/non-empty base.
    const persistedStatus = indexNonNullStageStatuses(
      section.stageStatuses,
      (status) => `${status.projectId}::${status.stageId}`,
    );
    const stages = authorEntry.stageAssignments.map((sa) => ({
      projectId: sa.projectId,
      stageName: sa.stageName,
      status: deriveForeignStageStatus(
        sa.stageName,
        sa.projectId,
        section.risks,
        persistedStatus.get(`${sa.projectId}::${sa.stageId}`) ?? null,
      ),
    }));

    return [
      {
        authorId: authorEntry.authorId,
        authorName: authorEntry.authorName,
        authorRole: authorEntry.authorRole,
        sharedProductIds: [...sharedIds],
        stages,
        // activity-first-class: the cross-lead grid is product-scoped — an
        // activity-parented row (null product FK) belongs to no shared product,
        // so the type-guard filter both narrows the type and excludes it.
        items: selectSharedItems(section.items, sharedIds),
        risks: section.risks
          .filter(
            (r): r is typeof r & { projectId: string } =>
              r.projectId != null && sharedIds.has(r.projectId),
          )
          // The DB column is a plain String (Risk_severity_check CHECK backs
          // the two-value vocabulary); narrow the Prisma-typed string here.
          .map((r) => ({
            ...r,
            severity: riskSeveritySchema.parse(r.severity),
          })),
        decisions: section.decisions.filter(
          (d): d is typeof d & { productId: string } =>
            d.productId != null && sharedIds.has(d.productId),
        ),
      },
    ];
  });
}
