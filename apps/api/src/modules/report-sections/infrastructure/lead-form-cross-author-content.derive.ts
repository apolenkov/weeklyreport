import {
  type DbRole,
  itemWorkflowStatusSchema,
  type RiskSeverity,
} from "@customreport/shared";

import type { CrossAuthorSectionRow } from "../domain/lead-form-shared";
import {
  deriveForeignStageStatus,
  type StageTrafficStatus,
} from "./lead-form-cross-author.derive.js";
import { indexNonNullStageStatuses } from "./non-null-stage-status-index.derive.js";

/** A co-owner's stage assignment on a shared, non-archived product. */
interface CrossAuthorStageAssignment {
  projectId: string;
  stageId: string;
  stageName: string;
}

/** Per-author scoping entry for the content read. */
interface CrossAuthorEntry {
  authorId: string;
  authorName: string;
  authorRole: DbRole;
  sharedProjectIds: Set<string>;
  stageAssignments: CrossAuthorStageAssignment[];
}

/** Row of foreign stage assignments the content read groups over. */
interface ForeignContentAssignmentRow {
  projectId: string;
  stageId: string;
  stage: { name: string };
  user: { id: string; name: string; role: DbRole };
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

/** Foreign section shape for the full-content cross-author read. */
interface ForeignContentSection {
  authorId: string;
  items: {
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
  risks: {
    id: string;
    projectId: string | null;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
  }[];
  decisions: {
    id: string;
    productId: string | null;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageNames: string[];
  }[];
  stageStatuses: {
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
          .map((r) => ({ ...r, severity: r.severity as RiskSeverity })),
        decisions: section.decisions.filter(
          (d): d is typeof d & { productId: string } =>
            d.productId != null && sharedIds.has(d.productId),
        ),
      },
    ];
  });
}
