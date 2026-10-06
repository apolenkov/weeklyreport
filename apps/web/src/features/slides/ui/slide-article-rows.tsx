import { type ReactNode, type RefObject, useId, useRef, useState } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
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
  useHoverTooltip,
} from "./slide-row-marks";

export { authorSlotBackground, StageLegend } from "./slide-row-marks";

export type SlideRowActivateHandler = (ref: GridRowEditableRef) => void;

// Activation is inert without editable lineage or a caller handler.
function createRowActivation({
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
  return { activatable, activate };
}

// The prose is the disclosure for every row. Editable rows retain deliberate
// double-click editing and gain an explicit keyboard path after expansion.
function RowBody({
  ariaLabel,
  controls,
  expanded,
  onEdit,
  onToggle,
  buttonRef,
  children,
}: {
  readonly ariaLabel: string;
  readonly controls: string;
  readonly expanded: boolean;
  readonly onEdit: (() => void) | undefined;
  readonly onToggle: () => void;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly children: ReactNode;
}) {
  // R16: on the single-column mobile deck a two-line clamp cuts most
  // headlines mid-thought; allow four lines below md, keep two on desktop.
  const bodyClassName = `${expanded ? "" : "line-clamp-4 md:line-clamp-2"} min-h-[34px] whitespace-normal break-words`;
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      onClick={onToggle}
      onDoubleClick={onEdit}
      className={`${bodyClassName} w-full cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}
    >
      {children}
    </button>
  );
}

function RowDetails({
  id,
  row,
  expanded,
  activatable,
  onEdit,
}: {
  readonly id: string;
  readonly row: GridRow;
  readonly expanded: boolean;
  readonly activatable: boolean;
  readonly onEdit: () => void;
}) {
  return (
    <div
      id={id}
      hidden={!expanded}
      className="mt-1 space-y-1 border-t border-current/15 pt-1 text-[12px]"
    >
      {expanded && (
        <>
          <p className="font-medium">{row.hoverLabel}</p>
          {(row.details ?? []).map(({ label, text }) => (
            <p key={label}>
              <span className="font-medium">{label}:</span> {text}
            </p>
          ))}
          {activatable && (
            <button
              type="button"
              aria-label={`Edit ${row.hoverLabel}: ${shortItemLabel(row.text)}`}
              onClick={onEdit}
              className="rounded-sm px-1 py-0.5 font-medium text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-foreground)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
            >
              Edit
            </button>
          )}
        </>
      )}
    </div>
  );
}

function RowMetadata({
  author,
  showStages,
  stageNames,
}: {
  readonly author: GridAuthor | undefined;
  readonly showStages: boolean;
  readonly stageNames: GridRow["stageNames"];
}) {
  return (
    <div
      data-testid="slide-row-metadata"
      className="flex w-6 min-w-0 flex-col justify-between gap-1 self-stretch"
    >
      <div
        data-testid="slide-row-metadata-top"
        className="flex items-start justify-end"
      >
        <AuthorBadge author={author} />
      </div>
      <div
        data-testid="slide-row-metadata-bottom"
        className="mt-auto flex flex-wrap items-end justify-end gap-0.5"
      >
        {showStages && <StageWatermarks stageNames={stageNames} />}
      </div>
    </div>
  );
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
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const bodyRef = useRef<HTMLButtonElement>(null);
  const srLabel = TONE_SR_LABEL[row.tone];
  const { activatable, activate } = createRowActivation({
    editableRef: row.editableRef,
    onRowActivate,
  });
  // Keep the card at two lines; pointer hover exposes its status and full text.
  // The metadata rail cannot change the prose's stable left edge.
  const detailLines = (row.details ?? []).map(
    ({ label, text }) => `${label}: ${text}`,
  );
  const statusTooltip = useHoverTooltip<HTMLLIElement>(
    [row.hoverLabel, row.text, ...detailLines].join("\n"),
  );
  return (
    <li
      {...statusTooltip}
      onKeyDown={(event) => {
        if (!expanded || event.key !== "Escape") return;
        event.preventDefault();
        setExpanded(false);
        bodyRef.current?.focus();
      }}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-1.5 rounded-md border px-2 py-1 text-[13px] leading-[1.3] ${TONE_BORDER[row.tone]}`}
    >
      <div data-testid="slide-row-content" className="min-w-0">
        {/* min-h = 2 lines at 13px x 1.3 line-height. */}
        <RowBody
          ariaLabel={`${expanded ? "Collapse" : "Expand"} full details for ${row.hoverLabel}: ${row.text}`}
          controls={detailsId}
          expanded={expanded}
          onEdit={activatable ? activate : undefined}
          onToggle={() => setExpanded((current) => !current)}
          buttonRef={bodyRef}
        >
          {row.text}
          {srLabel !== null && <span className="sr-only">{srLabel}</span>}
        </RowBody>
        <RowDetails
          id={detailsId}
          row={row}
          expanded={expanded}
          activatable={activatable}
          onEdit={activate}
        />
      </div>
      <RowMetadata
        author={author}
        showStages={showStages}
        stageNames={row.stageNames}
      />
    </li>
  );
}

// One grid cell: sorted rows of a single column, or the muted em-dash
// placeholder when the cell is empty (a short "No <label>" line on a phone).
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
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  if (rows.length === 0) {
    return (
      <span
        aria-label={`No ${label}`}
        className="text-[13px] text-[var(--color-muted-foreground)]"
      >
        <span aria-hidden="true" className="max-sm:hidden">
          —
        </span>
        <span aria-hidden="true" className="sm:hidden">
          No {label.toLowerCase()}
        </span>
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
