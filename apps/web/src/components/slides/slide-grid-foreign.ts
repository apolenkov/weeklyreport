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
    } as const;
    const items = ca.items.map((item): ForeignGridRow => {
      const isNext = item.type === "next";
      return {
        productId: item.projectId,
        column: isNext ? "next" : "current",
        row: {
          ...base,
          id: item.id,
          text: item.text.trim(),
          tone: item.workflowStatus === "done" ? "completed" : "neutral",
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
          tone: blocked ? "blocked" : "at-risk",
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
          tone: "note",
          stageNames: sortStageNames(decision.stageNames),
        },
      }),
    );
    return [...items, ...risks, ...decisions];
  });
}
