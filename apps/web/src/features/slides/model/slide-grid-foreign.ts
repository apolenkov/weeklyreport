import type { CrossAuthorContentRow } from "../../report-sections";
import {
  type GridColumnKey,
  type GridRow,
  itemToneEntry,
  sortStageNames,
  type ToneEntry,
} from "./slide-grid-rows";

const KNOWN_ITEM_STATUSES = [
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
] as const;

/** Everyone-mode item rows carry `workflowStatus` as a plain string (structural
 * mirror of untyped query data); known values reuse the exhaustive
 * own-item map, anything else reads neutral/"Planned" (same lenient coercion
 * convention as `coerceWorkflowToItemStatus`). */
function foreignItemToneEntry(workflowStatus: string): ToneEntry {
  const known = KNOWN_ITEM_STATUSES.find((status) => status === workflowStatus);
  return known === undefined
    ? { tone: "neutral", hoverLabel: "Planned" }
    : itemToneEntry(known);
}

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
      const { tone, hoverLabel } = foreignItemToneEntry(item.workflowStatus);
      return {
        productId: item.projectId,
        column: isNext ? "next" : "current",
        row: {
          ...base,
          id: item.id,
          text: item.text.trim(),
          tone,
          hoverLabel,
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
          hoverLabel: blocked ? "Blocked" : "At risk",
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
          hoverLabel: "Decision",
          stageNames: sortStageNames(decision.stageNames),
        },
      }),
    );
    return [...items, ...risks, ...decisions];
  });
}
