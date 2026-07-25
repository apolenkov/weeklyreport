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

// Known statuses reuse the own-item map; unknown values coerce to neutral/"Planned"
// (same lenient convention as coerceWorkflowToItemStatus).
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

// Author identity shared by every row of one co-owner.
type ForeignRowBase = Pick<GridRow, "authorId" | "showAuthorBadge">;

const toForeignItemRow =
  (base: ForeignRowBase) =>
  (item: CrossAuthorContentRow["items"][number]): ForeignGridRow => {
    const { tone, hoverLabel } = foreignItemToneEntry(item.workflowStatus);
    return {
      productId: item.projectId,
      column: item.type === "next" ? "next" : "current",
      row: {
        ...base,
        id: item.id,
        text: item.text.trim(),
        tone,
        hoverLabel,
        stageNames: sortStageNames(item.stageNames),
      },
    };
  };

const toForeignRiskRow =
  (base: ForeignRowBase) =>
  (risk: CrossAuthorContentRow["risks"][number]): ForeignGridRow => {
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
  };

const toForeignDecisionRow =
  (base: ForeignRowBase) =>
  (decision: CrossAuthorContentRow["decisions"][number]): ForeignGridRow => ({
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
  });

// Everyone-mode co-owner rows keep real author identity; foreign rows are never ranked.
export function buildForeignRows(
  foreign: readonly CrossAuthorContentRow[],
): ForeignGridRow[] {
  return foreign.flatMap((ca) => {
    const base: ForeignRowBase = {
      authorId: ca.authorId,
      showAuthorBadge: true,
    };
    return [
      ...ca.items.map(toForeignItemRow(base)),
      ...ca.risks.map(toForeignRiskRow(base)),
      ...ca.decisions.map(toForeignDecisionRow(base)),
    ];
  });
}
