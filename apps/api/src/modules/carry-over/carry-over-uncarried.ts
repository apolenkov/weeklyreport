import type { ReportSectionReadModel } from "@customreport/shared";

/**
 * One uncarried open record from the prior period, shaped for the head-view
 * signal (a compact list, not the full read model).
 */
export interface UncarriedRecord {
  readonly stableId: string | null;
  readonly text: string;
  readonly authorId: string;
  readonly authorName: string;
}

/**
 * The prior period's open work that has NOT been carried into the newly
 * opened period. `sourceReportId` is null when no prior period exists (or the
 * repository cannot resolve one) — the signal then stays silent. Nothing here
 * moves records; the head triggers the existing `carryOver.execute`.
 */
export interface UncarriedOpenWork {
  readonly sourceReportId: string | null;
  readonly items: readonly UncarriedRecord[];
  readonly decisions: readonly UncarriedRecord[];
}

export const EMPTY_UNCARRIED: UncarriedOpenWork = {
  sourceReportId: null,
  items: [],
  decisions: [],
};

function lineageSet(rows: readonly { stableId?: string }[]): Set<string> {
  return new Set(rows.flatMap((row) => (row.stableId ? [row.stableId] : [])));
}

/**
 * A next-week item can still be marked done (mark-complete leaves `type` as-is
 * and sets `workflowStatus=done`/`completed=true`). Finished work is closed, so
 * it must not be flagged as open work nor carried — mirrors the spec's "a done
 * record is not flagged" and stays aligned with `executeCarryOver`.
 */
function isDoneItem(item: {
  workflowStatus?: string | null;
  completed?: boolean | null;
}): boolean {
  return item.workflowStatus === "done" || item.completed === true;
}

/**
 * Pure difference between the prior period's carryable open records and the
 * target period's lineage. Scoped to exactly what `carryOver.execute` can
 * carry — open next-week items (any state incl. blocked, but NOT done) and
 * unresolved product-scoped decisions — so every surfaced record has a
 * one-click remedy. Risks are absent by design: a risk is re-raised, not
 * carried. A record whose lineage already exists in ANY target section counts
 * as carried; everything is read-only — nothing moves automatically.
 */
export function computeUncarriedOpenWork(
  sourceReportId: string,
  sourceSections: readonly ReportSectionReadModel[],
  targetSections: readonly ReportSectionReadModel[],
): UncarriedOpenWork {
  // Mirror `executeCarryOver` exactly: it carries a source author's records
  // ONLY into that same author's target section, and skips a lineage the
  // target already holds. A source author with no target section has nowhere
  // to carry, so execute never moves their records — surfacing them here would
  // promise a remedy the one-click button cannot deliver (a false-success
  // no-op). Scope the diff per author to the matching target section.
  const targetByAuthor = new Map(
    targetSections.map((target) => [target.authorId, target] as const),
  );

  const items = sourceSections.flatMap((section) => {
    const target = targetByAuthor.get(section.authorId);
    if (!target) return [];
    const carriedLineage = lineageSet(target.items);
    return section.items
      .filter(
        (item) =>
          item.type === "next" &&
          !item.carriedOver &&
          !isDoneItem(item) &&
          !(item.stableId !== undefined && carriedLineage.has(item.stableId)),
      )
      .map((item) => ({
        stableId: item.stableId ?? null,
        text: item.text,
        authorId: section.authorId,
        authorName: section.authorName,
      }));
  });

  const decisions = sourceSections.flatMap((section) => {
    const target = targetByAuthor.get(section.authorId);
    if (!target) return [];
    const carriedLineage = lineageSet(target.decisions);
    return section.decisions
      .filter(
        (decision) =>
          !decision.resolvedAt &&
          Boolean(decision.productId) &&
          !(
            decision.stableId !== undefined &&
            carriedLineage.has(decision.stableId)
          ),
      )
      .map((decision) => ({
        stableId: decision.stableId ?? null,
        text: decision.text,
        authorId: section.authorId,
        authorName: section.authorName,
      }));
  });

  return { sourceReportId, items, decisions };
}
