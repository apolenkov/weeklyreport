import { STAGE_ICONS } from "../lead/stage-chip-config";
import type { GridAuthor, GridBadge, GridRow } from "./slide-grid-model";

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
  // Invisible spacer keeps text alignment on 2nd+ rows of a same-author series.
  if (!show || author === undefined) {
    return <span aria-hidden="true" className="w-[22px] shrink-0" />;
  }
  return (
    <span
      title={author.name}
      data-testid="slide-author-badge"
      className="inline-flex h-[15px] w-[22px] shrink-0 items-center justify-center rounded text-[8px] font-semibold text-white"
      style={{ background: authorSlotBackground(author) }}
    >
      <span aria-hidden="true">{author.initials}</span>
      <span className="sr-only">{author.name}</span>
    </span>
  );
}

const BADGE_CONFIG: Record<
  Exclude<GridBadge, null>,
  { readonly label: string; readonly className: string }
> = {
  completed: {
    label: "COMPLETED",
    className:
      "bg-[var(--color-success)] text-[var(--color-primary)] border border-transparent",
  },
  "in-progress": {
    label: "IN PROGRESS",
    className:
      "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] border border-transparent",
  },
  planned: {
    label: "PLANNED",
    className:
      "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] border border-dashed border-[var(--color-border)]",
  },
  "at-risk": {
    label: "AT RISK",
    className:
      "bg-[var(--color-status-dot-at-risk)] text-white border border-transparent",
  },
};

function StatusBadge({ badge }: { readonly badge: GridBadge }) {
  if (badge === null) return null;
  const config = BADGE_CONFIG[badge];
  // Trails the item text inline (not a fixed side column), so the text keeps
  // the full column width and the badge wraps with the last line.
  return (
    <span
      className={`ml-1 inline-flex translate-y-[-1px] rounded px-1 py-0.5 align-middle text-[8px] font-semibold uppercase tracking-wide ${config.className}`}
    >
      {config.label}
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
      className="flex shrink-0 items-center gap-0.5 self-start pt-[2px] opacity-[0.28]"
    >
      {stageNames.map((stageName) => {
        const Icon = STAGE_ICONS[stageName];
        if (!Icon) return null;
        return (
          <span key={stageName} title={stageName}>
            <Icon className="h-[11px] w-[11px]" />
          </span>
        );
      })}
    </span>
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
  // Blocked-risk emphasis: highlighted row, no badge; the negative left margin
  // keeps the highlight flush with the column's text edge.
  const highlight = row.blockerHighlight
    ? "-ml-2 rounded-md bg-[var(--color-chip-blocked-bg)] py-1 pl-2 pr-2"
    : "";
  return (
    <li className={`flex gap-1.5 text-[13px] leading-[1.3] ${highlight}`}>
      <AuthorBadge author={author} show={row.showAuthorBadge} />
      {row.priorityRank != null && (
        <span className="inline-flex h-[15px] shrink-0 items-center rounded bg-[var(--color-status-dot-at-risk)] px-1 text-[8px] font-semibold text-white">
          P{row.priorityRank}
        </span>
      )}
      {showStages && <StageWatermarks stageNames={row.stageNames} />}
      <span className="min-w-0 flex-1 whitespace-normal break-words">
        {row.text}
        <StatusBadge badge={row.badge} />
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
