import { Check } from "lucide-react";
import { useRef } from "react";

import { STAGE_ICONS } from "../lead/stage-chip-config";
import { useSdlcTooltip } from "../ui/sdlc-tooltip";
import type { GridAuthor, GridRow, GridTone } from "./slide-grid-model";

/** Hover/focus handlers wiring an element to the singleton slide tooltip. */
function useHoverTooltip<T extends HTMLElement = HTMLSpanElement>(
  content: string,
) {
  const ref = useRef<T | null>(null);
  const tooltip = useSdlcTooltip();
  return {
    ref,
    onMouseEnter: () => {
      const el = ref.current;
      if (el) tooltip.show(el.getBoundingClientRect(), content);
    },
    onMouseLeave: () => {
      tooltip.hide();
    },
  };
}

/** Background for an author's identity slot (cycled tokens, owner = slot 0). */
export function authorSlotBackground(author: GridAuthor): string {
  return `var(--slide-author-${String(author.colorIndex)})`;
}

function AuthorBadge({
  author,
  show,
}: {
  readonly author: GridAuthor | undefined;
  readonly show: boolean;
}) {
  // Hooks precede the early return (rules-of-hooks); the label mirrors the
  // footer legend entry so hover answers "who" without leaving the row.
  const label =
    author === undefined
      ? ""
      : author.role === undefined
        ? author.name
        : `${author.name} · ${author.role}`;
  const tooltip = useHoverTooltip(label);
  // Inline in the text flow — no reserved column, the text wraps around it.
  if (!show || author === undefined) return null;
  return (
    <span
      {...tooltip}
      data-testid="slide-author-badge"
      className="mr-1 inline-flex h-[15px] w-[22px] translate-y-[-1px] items-center justify-center rounded align-middle text-[8px] font-semibold text-[var(--color-foreground)]"
      style={{ background: authorSlotBackground(author) }}
    >
      <span aria-hidden="true">{author.initials}</span>
      <span className="sr-only">{author.name}</span>
    </span>
  );
}

/** The frame IS the status: neutral for expected work, green for done,
 * yellow for at-risk, red for blocked — no status words on the row. */
const TONE_BORDER: Record<GridTone, string> = {
  neutral: "border-[rgba(0,0,0,0.10)]",
  completed: "border-[var(--color-chip-on-track-border)]",
  "at-risk": "border-[var(--color-status-at-risk-border)]",
  blocked: "border-[var(--color-destructive)]",
};

/** sr-only status per tone — keeps the frame hue readable for screen readers
 * and grayscale print. Neutral rows stay silent (expected state). */
const TONE_SR_LABEL: Record<GridTone, string | null> = {
  neutral: null,
  completed: "Completed",
  "at-risk": "At risk",
  blocked: "Blocked",
};

/** Quiet check glyph on done rows — the frame goes grayscale in print, the
 * glyph shape does not. */
function CompletedMark({ tone }: { readonly tone: GridTone }) {
  if (tone !== "completed") return null;
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-flex translate-y-[-1px] align-middle text-[var(--color-primary)]"
    >
      <Check className="h-3 w-3" />
    </span>
  );
}

function StageWatermark({ stageName }: { readonly stageName: string }) {
  const tooltip = useHoverTooltip(stageName);
  const Icon = STAGE_ICONS[stageName];
  if (!Icon) return null;
  return (
    <span {...tooltip}>
      <Icon className="h-[11px] w-[11px]" />
    </span>
  );
}

function StageWatermarks({
  stageNames,
}: {
  readonly stageNames: readonly string[];
}) {
  if (stageNames.length === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-flex translate-y-[1px] items-center gap-0.5 align-baseline opacity-[0.28]"
    >
      {stageNames.map((stageName) => (
        <StageWatermark key={stageName} stageName={stageName} />
      ))}
    </span>
  );
}

/** Footer legend for the stage watermark icons — one entry per stage that
 * actually appears on the slide, in the canonical pipeline order. */
export function StageLegend({
  stageNames,
}: {
  readonly stageNames: readonly string[];
}) {
  if (stageNames.length === 0) return null;
  return (
    <div
      data-testid="slide-stage-legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--color-muted-foreground)]"
    >
      {stageNames.map((stageName) => {
        const Icon = STAGE_ICONS[stageName];
        if (!Icon) return null;
        return (
          <span key={stageName} className="inline-flex items-center gap-1">
            <Icon aria-hidden="true" className="h-[11px] w-[11px]" />
            {stageName}
          </span>
        );
      })}
    </div>
  );
}

function ItemRow({
  row,
  author,
  showStages,
}: {
  readonly row: GridRow;
  readonly author: GridAuthor | undefined;
  readonly showStages: boolean;
}) {
  const srLabel = TONE_SR_LABEL[row.tone];
  // Every row is the same two-line card (short text still occupies two lines,
  // longer text clamps to an ellipsis; hover shows it in full). Badges and
  // icons ride the text inline, so nothing indents the body.
  const textTooltip = useHoverTooltip<HTMLLIElement>(row.text);
  return (
    <li
      {...textTooltip}
      className={`min-w-0 rounded-md border px-2 py-1 text-[13px] leading-[1.3] ${TONE_BORDER[row.tone]}`}
    >
      {/* min-h = 2 lines at 13px x 1.3 line-height. */}
      <span className="line-clamp-2 min-h-[34px] whitespace-normal break-words">
        <AuthorBadge author={author} show={row.showAuthorBadge} />
        {showStages && <StageWatermarks stageNames={row.stageNames} />}
        {row.text}
        <CompletedMark tone={row.tone} />
        {srLabel !== null && <span className="sr-only">{srLabel}</span>}
      </span>
    </li>
  );
}

/** One grid cell: the sorted, author-collapsed rows of a single column, or the
 * muted em-dash placeholder when the cell is empty. */
export function SlideCell({
  rows,
  authorsById,
  showStages,
  label,
}: {
  readonly rows: readonly GridRow[];
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly showStages: boolean;
  readonly label: string;
}) {
  if (rows.length === 0) {
    return (
      <span
        aria-label={`No ${label}`}
        className="text-[13px] text-[var(--color-muted-foreground)]"
      >
        —
      </span>
    );
  }
  return (
    <ul aria-label={label} className="min-w-0 space-y-1">
      {rows.map((row) => (
        <ItemRow
          key={row.id}
          row={row}
          author={authorsById.get(row.authorId)}
          showStages={showStages}
        />
      ))}
    </ul>
  );
}
