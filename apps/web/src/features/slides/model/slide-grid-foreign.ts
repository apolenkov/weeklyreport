import type { CrossAuthorContentRow } from "../../report-sections";
import {
  type GridColumnKey,
  type GridRow,
  itemToneEntry,
  sortStageNames,
} from "./slide-grid-rows";

export interface ForeignGridRow {
  readonly row: GridRow;
  readonly productId: string;
  readonly column: GridColumnKey;
}

// Author identity shared by every row of one co-owner.
type ForeignRowBase = Pick<GridRow, "authorId">;

const toForeignItemRow =
  (base: ForeignRowBase) =>
  (item: CrossAuthorContentRow["items"][number]): ForeignGridRow => {
    const { tone, hoverLabel } = itemToneEntry(item.workflowStatus);
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
    const details = [
      ...(risk.impact.trim().length > 0
        ? [{ label: "Impact" as const, text: risk.impact.trim() }]
        : []),
      ...(risk.mitigation.trim().length > 0
        ? [{ label: "Mitigation" as const, text: risk.mitigation.trim() }]
        : []),
    ];
    return {
      productId: risk.projectId,
      column: "risks",
      row: {
        ...base,
        id: risk.id,
        text: risk.risk.trim(),
        tone: blocked ? "blocked" : "at-risk",
        hoverLabel: blocked ? "Blocked" : "At risk",
        ...(details.length === 0 ? {} : { details }),
        stageNames: sortStageNames(risk.stageNames),
      },
    };
  };

const toForeignDecisionRow =
  (base: ForeignRowBase) =>
  (decision: CrossAuthorContentRow["decisions"][number]): ForeignGridRow => {
    const impact = decision.impact.trim();
    return {
      productId: decision.productId,
      column: "decisions",
      row: {
        ...base,
        id: decision.id,
        text: decision.text.trim(),
        tone: "note",
        hoverLabel: "Decision",
        ...(impact.length === 0
          ? {}
          : { details: [{ label: "Impact", text: impact }] }),
        stageNames: sortStageNames(decision.stageNames),
      },
    };
  };

// Everyone-mode co-owner rows keep real author identity; foreign rows are never ranked.
export function buildForeignRows(
  foreign: readonly CrossAuthorContentRow[],
): ForeignGridRow[] {
  return foreign.flatMap((ca) => {
    const base: ForeignRowBase = {
      authorId: ca.authorId,
    };
    return [
      ...ca.items.map(toForeignItemRow(base)),
      ...ca.risks.map(toForeignRiskRow(base)),
      ...ca.decisions.map(toForeignDecisionRow(base)),
    ];
  });
}
