import { type KeyboardEvent } from "react";

import type {
  GridAuthor,
  GridRow,
  GridRowEditableRef,
} from "../model/slide-grid-model";
import {
  AuthorBadge,
  StageWatermarks,
  TONE_BORDER,
  TONE_SR_LABEL,
  ToneMark,
  useHoverTooltip,
} from "./slide-row-marks";

export { authorSlotBackground, StageLegend } from "./slide-row-marks";

export type SlideRowActivateHandler = (ref: GridRowEditableRef) => void;

/** Wires a row's double-click/keyboard activation, inert whenever the row
 * carries no editable lineage or the caller passed no activation handler. */
function useRowActivation({
  editableRef,
  onRowActivate,
}: {
  readonly editableRef: GridRowEditableRef | undefined;
  readonly onRowActivate: SlideRowActivateHandler | undefined;
}) {
  const activatable = editableRef !== undefined && onRowActivate !== undefined;
  const activate = () => {
    if (editableRef === undefined) return;
    onRowActivate?.(editableRef);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    // Space's default on a non-native button element is page scroll, so the
    // guard runs for both activation keys per the role="button" contract.
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate();
  };
  return { activatable, activate, handleKeyDown };
}

function ItemRow({
  row,
  author,
  showStages,
  onRowActivate,
}: {
  readonly row: GridRow;
  readonly author: GridAuthor | undefined;
  readonly showStages: boolean;
  readonly onRowActivate?: SlideRowActivateHandler;
}) {
  const srLabel = TONE_SR_LABEL[row.tone];
  const { activatable, activate, handleKeyDown } = useRowActivation({
    editableRef: row.editableRef,
    onRowActivate,
  });
  // Two-line card always: hover shows status + full text so a clamped row never
  // hides its tail; badges/icons ride inline so nothing indents the body.
  const statusTooltip = useHoverTooltip<HTMLLIElement>(
    `${row.hoverLabel}\n${row.text}`,
  );
  const content = (
    <>
      <AuthorBadge author={author} show={row.showAuthorBadge} />
      {showStages && <StageWatermarks stageNames={row.stageNames} />}
      {row.text}
      <ToneMark tone={row.tone} />
      {srLabel !== null && <span className="sr-only">{srLabel}</span>}
    </>
  );
  return (
    <li
      {...statusTooltip}
      className={`min-w-0 rounded-md border px-2 py-1 text-[13px] leading-[1.3] ${TONE_BORDER[row.tone]}`}
    >
      {/* min-h = 2 lines at 13px x 1.3 line-height. */}
      {activatable ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Edit ${row.hoverLabel}: ${row.text}`}
          onDoubleClick={activate}
          onKeyDown={handleKeyDown}
          className="line-clamp-2 min-h-[34px] cursor-pointer whitespace-normal break-words rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {content}
        </span>
      ) : (
        <span className="line-clamp-2 min-h-[34px] whitespace-normal break-words">
          {content}
        </span>
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
  onRowActivate,
}: {
  readonly rows: readonly GridRow[];
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly showStages: boolean;
  readonly label: string;
  readonly onRowActivate?: SlideRowActivateHandler;
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
    <ul aria-label={label} className="min-w-0 space-y-1.5">
      {rows.map((row) => (
        <ItemRow
          key={row.id}
          row={row}
          author={authorsById.get(row.authorId)}
          showStages={showStages}
          onRowActivate={onRowActivate}
        />
      ))}
    </ul>
  );
}
