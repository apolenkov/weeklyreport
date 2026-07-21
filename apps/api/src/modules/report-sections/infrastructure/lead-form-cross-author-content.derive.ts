import type {
  DbRole,
  RiskSeverity,
  TrafficLightStatus,
} from "@customreport/shared";

import type { CrossAuthorSectionRow } from "../domain/lead-form-shared";
import {
  deriveForeignStageStatus,
  type StageTrafficStatus,
} from "./lead-form-cross-author.derive.js";

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

/**
 * Groups foreign stage assignments into per-author scoping entries, preserving
 * first-seen insertion order. `coOwnsShared` is the co-ownership authorization
 * signal (true iff the caller co-owns at least one shared, non-archived
 * product); `otherUserIds` are the co-owner ids for the section fetch.
 */
export function groupCrossAuthorAuthors(
  others: readonly ForeignContentAssignmentRow[],
): {
  authorEntries: Map<string, CrossAuthorEntry>;
  coOwnsShared: boolean;
  otherUserIds: string[];
} {
  const authorEntries = others.reduce<Map<string, CrossAuthorEntry>>(
    (acc, row) => {
      const assignment = {
        projectId: row.projectId,
        stageId: row.stageId,
        stageName: row.stage.name,
      };
      const existing = acc.get(row.user.id);
      if (existing) {
        return new Map(acc).set(row.user.id, {
          ...existing,
          sharedProjectIds: new Set([
            ...existing.sharedProjectIds,
            row.projectId,
          ]),
          stageAssignments: [...existing.stageAssignments, assignment],
        });
      }
      return new Map(acc).set(row.user.id, {
        authorId: row.user.id,
        authorName: row.user.name,
        authorRole: row.user.role,
        sharedProjectIds: new Set([row.projectId]),
        stageAssignments: [assignment],
      });
    },
    new Map(),
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

/**
 * Builds per-author content rows scoped to shared products only, preserving
 * `sections` order. Sections whose author is not a co-owner are skipped; each
 * stage chip is risk-derived and the record collections are filtered to the
 * author's shared products (activity-parented rows with null FK drop out).
 */
export function buildCrossAuthorContentRows(
  sections: readonly ForeignContentSection[],
  authorEntries: ReadonlyMap<string, CrossAuthorEntry>,
): CrossAuthorSectionRow[] {
  return sections.flatMap((section) => {
    const authorEntry = authorEntries.get(section.authorId);
    if (!authorEntry) return [];
    const sharedIds = authorEntry.sharedProjectIds;

    // Risk-derived foreign stage chips (canonical rule), reusing the same
    // derivation as the status-only read. The author's stage assignments on
    // shared products (collected above) define which chips exist; the
    // section's persisted statuses provide the empty/non-empty base.
    const persistedStatus = new Map<string, TrafficLightStatus>(
      section.stageStatuses.flatMap((ss) =>
        ss.status !== null
          ? ([[`${ss.projectId}::${ss.stageId}`, ss.status]] as [
              string,
              TrafficLightStatus,
            ][])
          : [],
      ),
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
        items: section.items.filter(
          (i): i is typeof i & { projectId: string } =>
            i.projectId != null && sharedIds.has(i.projectId),
        ),
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
