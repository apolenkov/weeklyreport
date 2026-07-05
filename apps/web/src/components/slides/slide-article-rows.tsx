import { Check } from "lucide-react";
import { useRef } from "react";

import { STAGE_ICONS } from "../lead/stage-chip-config";
import { useSdlcTooltip } from "../ui/sdlc-tooltip";
import type { GridAuthor, GridHighlight, GridRow } from "./slide-grid-model";

/** Hover/focus handlers wiring an element to the singleton slide tooltip. */
function useHoverTooltip(content: string) {
  const ref = useRef<HTMLSpanElement | null>(null);
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

/** The only per-row status mark: a quiet check glyph on done items, trailing
 * the text inline so wrapped lines keep the full column width. Every other
 * status reads from the row's background/border, never from words. */
function CompletedMark({ completed }: { readonly completed: boolean }) {
  if (!completed) return null;
  return (
    <span className="ml-1 inline-flex translate-y-[-1px] align-middle text-[var(--color-primary)]">
      <Check aria-hidden="true" className="h-3 w-3" />
      <span className="sr-only">Completed</span>
    </span>
  );
}

/** Risk emphasis plays background and border, not status text: blocked is the
 * loud filled tint, at-risk the quieter bordered wash. sr-only keeps the
 * severity readable for screen readers and grayscale print. */
const HIGHLIGHT_CLASS: Record<Exclude<GridHighlight, null>, string> = {
  blocked: "-mx-2 rounded-md bg-[var(--color-chip-blocked-bg)] px-2 py-1",
  "at-risk":
    "-mx-2 rounded-md border border-[var(--color-status-at-risk-border)] bg-[var(--color-status-at-risk-bg)] px-2 py-1",
};

const HIGHLIGHT_SR_LABEL: Record<Exclude<GridHighlight, null>, string> = {
  blocked: "Blocked",
  "at-risk": "At risk",
};

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
  const highlight =
    row.highlight === null ? "" : HIGHLIGHT_CLASS[row.highlight];
  // One flowing paragraph: badges and icons ride the text instead of columns,
  // so wrapped lines start at the cell edge and nothing indents the body.
  return (
    <li
      className={`min-w-0 whitespace-normal break-words text-[13px] leading-[1.3] ${highlight}`}
    >
      <AuthorBadge author={author} show={row.showAuthorBadge} />
      {showStages && <StageWatermarks stageNames={row.stageNames} />}
      {row.text}
      <CompletedMark completed={row.completed} />
      {row.highlight !== null && (
        <span className="sr-only">{HIGHLIGHT_SR_LABEL[row.highlight]}</span>
      )}
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
