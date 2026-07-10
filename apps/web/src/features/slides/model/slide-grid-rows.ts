import type { TrafficLightStatus } from "@customreport/shared";
import {
  normalizeStageName,
  type ReportSectionReadModel,
  STAGE_NAMES,
} from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections/model/lead-cross-author";

export type SlideTrafficStatus = TrafficLightStatus | null;

/** Per-row frame tone: every row is a bordered two-line card; the border hue
 * IS the status — neutral (expected work), green (done), yellow (at-risk),
 * red (blocked), plus the dashed paused/postponed work states. */
export type GridTone =
  | "neutral"
  | "note"
  | "completed"
  | "at-risk"
  | "blocked"
  | "paused"
  | "postponed";

export type GridRowKind = "item" | "risk" | "decision";

export interface GridRowEditableRef {
  readonly kind: GridRowKind;
  readonly stableId: string;
}

export interface GridAuthor {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly initials: string;
  /** Index into the author color-token cycle (0..AUTHOR_COLOR_COUNT-1). */
  readonly colorIndex: number;
  readonly isOwner: boolean;
}

export interface GridRow {
  readonly id: string;
  readonly text: string;
  readonly authorId: string;
  /** False on 2nd+ rows of a same-author series — the badge is omitted. */
  readonly showAuthorBadge: boolean;
  readonly tone: GridTone;
  /** Status word shown on hover — the frame stays word-free; the tooltip
   * pairs this status with the full row text (which the row itself clamps). */
  readonly hoverLabel: string;
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

/** Distinct author color tokens before the cycle repeats. */
export const AUTHOR_COLOR_COUNT = 6;

const INITIALS_TOKENS = 2;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, INITIALS_TOKENS)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");
}

export interface AuthorRoster {
  readonly owner: GridAuthor;
  /** Owner first, foreign authors after in name order — legend order. */
  readonly authors: readonly GridAuthor[];
}

export function buildAuthorRoster(
  section: ReportSectionReadModel,
  foreign: readonly CrossAuthorContentRow[],
): AuthorRoster {
  const foreignById = new Map(
    foreign
      .filter((row) => row.authorId !== section.authorId)
      .map((row) => [
        row.authorId,
        { name: row.authorName, role: row.authorRole },
      ]),
  );
  const foreignAuthors = [...foreignById.entries()].sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );
  const authors = [
    {
      id: section.authorId,
      name: section.authorName,
      ...(section.authorRole === undefined ? {} : { role: section.authorRole }),
      initials: initialsOf(section.authorName),
      colorIndex: 0,
      isOwner: true,
    },
    ...foreignAuthors.map(([id, { name, role }], index) => ({
      id,
      name,
      ...(role === undefined ? {} : { role }),
      initials: initialsOf(name),
      colorIndex: (index + 1) % AUTHOR_COLOR_COUNT,
      isOwner: false,
    })),
  ];
  const owner = authors[0];
  return { owner, authors };
}

const UNKNOWN_STAGE_RANK = STAGE_NAMES.length;

function stageRank(stageName: string): number {
  const index = STAGE_NAMES.findIndex(
    (canonical) =>
      // The alias-folding comparison (Development ↔ Dev) both sides use.
      normalizeStageName(canonical) === normalizeStageName(stageName),
  );
  return index === -1 ? UNKNOWN_STAGE_RANK : index;
}

/** Canonical-pipeline order; names outside the pipeline keep input order last. */
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

/** Exhaustive workflow-status → (tone, hover label) map — no default case, so
 * a new enum member fails the build instead of reading silently neutral. */
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
    showAuthorBadge: true,
    tone,
    hoverLabel,
    stageNames: sortStageNames(item.stageIds ?? []),
    ...editableRef("item", item.stableId),
  };
}

export function buildOwnRiskRow(
  risk: OwnRisk,
  owner: GridAuthor,
  index: number,
): GridRow {
  const blocked = risk.severity === "blocked";
  return {
    id: rowId(risk.id, risk.stableId, "risk", index),
    text: risk.risk.trim(),
    authorId: owner.id,
    showAuthorBadge: true,
    tone: blocked ? "blocked" : "at-risk",
    hoverLabel: blocked ? "Blocked" : "At risk",
    stageNames: sortStageNames(risk.stageIds ?? []),
    ...editableRef("risk", risk.stableId),
  };
}

export function buildOwnDecisionRow(
  decision: OwnDecision,
  owner: GridAuthor,
  index: number,
): GridRow {
  return {
    id: rowId(decision.id, decision.stableId, "decision", index),
    text: decision.text.trim(),
    authorId: owner.id,
    showAuthorBadge: true,
    // Decisions are facts, not work in flight — solid quiet frame.
    tone: "note",
    hoverLabel: "Decision",
    stageNames: sortStageNames(decision.stageIds ?? []),
    ...editableRef("decision", decision.stableId),
  };
}

const FIRST_STAGE_FALLBACK_RANK = UNKNOWN_STAGE_RANK + 1;

function firstStageRank(row: GridRow): number {
  return row.stageNames.length === 0
    ? FIRST_STAGE_FALLBACK_RANK
    : stageRank(row.stageNames[0]);
}

/** Stage order first (stage-less rows last), then author (owner first, legend
 * order after), then original position — a stable, deterministic cell order. */
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

/** Badge only on the first row of a consecutive same-author series. */
export function collapseAuthorSeries(
  rows: readonly GridRow[],
): readonly GridRow[] {
  return rows.map((row, index) => ({
    ...row,
    showAuthorBadge: index === 0 || rows[index - 1]?.authorId !== row.authorId,
  }));
}
