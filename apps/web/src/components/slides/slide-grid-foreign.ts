import type { CrossAuthorContentRow } from "../../lib/mappers/lead-cross-author";
import {
  type GridColumnKey,
  type GridRow,
  sortStageNames,
} from "./slide-grid-rows";

export interface ForeignGridRow {
  readonly row: GridRow;
  readonly productId: string;
  readonly column: GridColumnKey;
}

/** Everyone-mode co-owner rows WITH author identity (never anonymized) and no
 * priority rank (foreign rows are excluded from ranking by design). */
export function buildForeignRows(
  foreign: readonly CrossAuthorContentRow[],
): ForeignGridRow[] {
  return foreign.flatMap((ca) => {
    const base = {
      authorId: ca.authorId,
      showAuthorBadge: true,
      blockerHighlight: false,
    };
    const items = ca.items.map((item): ForeignGridRow => {
      const isNext = item.type === "next";
      return {
        productId: item.projectId,
        column: isNext ? "next" : "current",
        row: {
          ...base,
          id: item.id,
          text: item.text.trim(),
          badge: isNext
            ? "planned"
            : item.workflowStatus === "done"
              ? "completed"
              : "in-progress",
          stageNames: sortStageNames(item.stageNames),
        },
      };
    });
    const risks = ca.risks.map((risk): ForeignGridRow => {
      const blocked = risk.severity === "blocked";
      return {
        productId: risk.projectId,
        column: "risks",
        row: {
          ...base,
          id: risk.id,
          text: risk.risk.trim(),
          badge: blocked ? null : "at-risk",
          blockerHighlight: blocked,
          stageNames: sortStageNames(risk.stageNames),
        },
      };
    });
    const decisions = ca.decisions.map(
      (decision): ForeignGridRow => ({
        productId: decision.productId,
        column: "decisions",
        row: {
          ...base,
          id: decision.id,
          text: decision.text.trim(),
          badge: null,
          stageNames: sortStageNames(decision.stageNames),
        },
      }),
    );
    return [...items, ...risks, ...decisions];
  });
}
