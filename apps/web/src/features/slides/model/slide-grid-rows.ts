import type { TrafficLightStatus } from "@customreport/shared";
import { type ReportSectionReadModel, STAGE_NAMES } from "@customreport/shared";

export type SlideTrafficStatus = TrafficLightStatus | null;

// Trimmed non-empty text is the shared content predicate for every row filter.
export function hasText(text: string | null | undefined): text is string {
  return typeof text === "string" && text.trim().length > 0;
}

// Frame tone maps the row status to its bordered two-line card treatment.
export type GridTone =
  | "neutral"
  | "note"
  | "completed"
  | "at-risk"
  | "blocked"
  | "paused"
  | "postponed";

type GridRowKind = "item" | "risk" | "decision";

export interface GridRowEditableRef {
  readonly kind: GridRowKind;
  readonly stableId: string;
}

interface GridRowDetail {
  readonly label: "Impact" | "Mitigation";
  readonly text: string;
}

export interface GridAuthor {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly initials: string;
  readonly colorIndex: number;
  readonly isOwner: boolean;
}

export interface GridRow {
  readonly id: string;
  readonly text: string;
  readonly authorId: string;
  readonly tone: GridTone;
  // Hover combines this status with full text while the row body stays clamped.
  readonly hoverLabel: string;
  // Supporting prose stays out of the compact card and appears in full-text disclosure.
  readonly details?: readonly GridRowDetail[];
  readonly stageNames: readonly string[];
  readonly editableRef?: GridRowEditableRef;
}

export interface GridColumns {
  readonly current: readonly GridRow[];
  readonly next: readonly GridRow[];
  readonly risks: readonly GridRow[];
  readonly decisions: readonly GridRow[];
}

export type GridColumnKey = keyof GridColumns;

// Load-bearing: record-identity strings and page chunking must walk the
// columns in the same order, so both read this single table.
export const COLUMN_ORDER: readonly (keyof GridColumns)[] = [
  "current",
  "next",
  "risks",
  "decisions",
];

const UNKNOWN_STAGE_RANK = STAGE_NAMES.length;

function stageRank(stageName: string): number {
  const index = STAGE_NAMES.findIndex((canonical) => canonical === stageName);
  return index === -1 ? UNKNOWN_STAGE_RANK : index;
}

// Canonical pipeline names sort first; unknown names stay last.
export function sortStageNames(names: readonly string[]): readonly string[] {
  return [...names].sort((a, b) => stageRank(a) - stageRank(b));
}

type OwnItem = ReportSectionReadModel["items"][number];
type OwnRisk = ReportSectionReadModel["risks"][number];
type OwnDecision = ReportSectionReadModel["decisions"][number];

const rowId = (
  id: string | undefined,
  stableId: string | undefined,
  kind: string,
  index: number,
): string => id ?? stableId ?? `${kind}-${String(index)}`;

const editableRef = (
  kind: GridRowKind,
  stableId: string | null | undefined,
): { readonly editableRef: GridRowEditableRef } | Record<string, never> =>
  stableId == null ? {} : { editableRef: { kind, stableId } };

export interface ToneEntry {
  readonly tone: GridTone;
  readonly hoverLabel: string;
}

// Exhaustive status mapping intentionally has no default, so new workflow
// members fail the build instead of silently becoming neutral.
export function itemToneEntry(status: OwnItem["workflowStatus"]): ToneEntry {
  switch (status) {
    case "done":
      return { tone: "completed", hoverLabel: "Completed" };
    case "paused":
      return { tone: "paused", hoverLabel: "Paused" };
    case "postponed":
      return { tone: "postponed", hoverLabel: "Postponed" };
    case "planned":
      return { tone: "neutral", hoverLabel: "Planned" };
    case "in_progress":
      return { tone: "neutral", hoverLabel: "In progress" };
  }
}

export function buildOwnItemRow(
  item: OwnItem,
  owner: GridAuthor,
  index: number,
): GridRow {
  const { tone, hoverLabel } = itemToneEntry(item.workflowStatus);
  return {
    id: rowId(item.id, item.stableId, "item", index),
    text: item.text.trim(),
    authorId: owner.id,
    tone,
    hoverLabel,
    stageNames: sortStageNames(item.stageNames),
    ...editableRef("item", item.stableId),
  };
}

export function buildOwnRiskRow(
  risk: OwnRisk,
  owner: GridAuthor,
  index: number,
): GridRow {
  const blocked = risk.severity === "blocked";
  const details: GridRowDetail[] = [
    ...(hasText(risk.impact)
      ? [{ label: "Impact" as const, text: risk.impact.trim() }]
      : []),
    ...(hasText(risk.mitigation)
      ? [{ label: "Mitigation" as const, text: risk.mitigation.trim() }]
      : []),
  ];
  return {
    id: rowId(risk.id, risk.stableId, "risk", index),
    text: risk.risk.trim(),
    authorId: owner.id,
    tone: blocked ? "blocked" : "at-risk",
    hoverLabel: blocked ? "Blocked" : "At risk",
    ...(details.length === 0 ? {} : { details }),
    stageNames: sortStageNames(risk.stageNames),
    ...editableRef("risk", risk.stableId),
  };
}

export function buildOwnDecisionRow(
  decision: OwnDecision,
  owner: GridAuthor,
  index: number,
): GridRow {
  const details: GridRowDetail[] = hasText(decision.impact)
    ? [{ label: "Impact", text: decision.impact.trim() }]
    : [];
  return {
    id: rowId(decision.id, decision.stableId, "decision", index),
    text: decision.text.trim(),
    authorId: owner.id,
    // Decisions are facts, not work in flight — solid quiet frame.
    tone: "note",
    hoverLabel: "Decision",
    ...(details.length === 0 ? {} : { details }),
    stageNames: sortStageNames(decision.stageNames),
    ...editableRef("decision", decision.stableId),
  };
}

const FIRST_STAGE_FALLBACK_RANK = UNKNOWN_STAGE_RANK + 1;

function firstStageRank(row: GridRow): number {
  const [firstStage] = row.stageNames;
  return firstStage === undefined
    ? FIRST_STAGE_FALLBACK_RANK
    : stageRank(firstStage);
}

// Sort by stage, then author order, then original position for stable cells.
export function sortCellRows(
  rows: readonly GridRow[],
  authorOrder: ReadonlyMap<string, number>,
): readonly GridRow[] {
  const position = new Map(rows.map((row, index) => [row.id, index]));
  const authorRank = (row: GridRow): number =>
    authorOrder.get(row.authorId) ?? authorOrder.size;
  return [...rows].sort(
    (a, b) =>
      firstStageRank(a) - firstStageRank(b) ||
      authorRank(a) - authorRank(b) ||
      (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  );
}
