import { useEffect, useRef, useState } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewQuickEditMemory,
} from "../model/status-overview";
import { PreviewActions } from "./status-overview-item-actions";
import { PreviewMetadata } from "./status-overview-item-metadata";
import { OutcomeAudit } from "./status-overview-outcome-audit";
import { StatusOverviewQuickEditForm } from "./status-overview-quick-edit-form";
import { TrackedWorkComments } from "./status-overview-record-comments";

const LONG_UPDATE_LENGTH = 120;

function quickEditIsOpen(
  memory: StatusOverviewQuickEditMemory | undefined,
  retainedDraft: string | null,
  editable: boolean,
  localEditing: boolean,
): boolean {
  return memory ? retainedDraft !== null : editable && localEditing;
}

function submitQuickEdit(
  item: StatusOverviewItem,
  draft: string,
  onQuickEditText:
    ((item: StatusOverviewItem, text: string) => void) | undefined,
): void {
  const next = draft.trim();
  if (onQuickEditText && next.length > 0 && next !== item.text) {
    onQuickEditText(item, next);
  }
}

function writeQuickEdit(
  memory: StatusOverviewQuickEditMemory | undefined,
  item: StatusOverviewItem,
  next: string,
  writeLocal: (value: string) => void,
): void {
  if (memory) memory.write(item, next);
  else writeLocal(next);
}

function previewTextClassName(expanded: boolean, canCollapse: boolean): string {
  return `${expanded || !canCollapse ? "block" : "line-clamp-2"} min-h-10 break-words text-sm leading-5 [overflow-wrap:anywhere]`;
}

function PreviewText({
  item,
  expanded,
  onEditItem,
  onQuickEditText,
  quickEditMemory,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly quickEditMemory?: StatusOverviewQuickEditMemory | undefined;
}) {
  const canCollapse = item.text.length > LONG_UPDATE_LENGTH;
  const [localEditing, setLocalEditing] = useState(false);
  const [localDraft, setLocalDraft] = useState(item.text);
  const retainedDraft = quickEditMemory?.read(item) ?? null;
  const editing = quickEditIsOpen(
    quickEditMemory,
    retainedDraft,
    Boolean(onQuickEditText),
    localEditing,
  );
  const draft = retainedDraft ?? localDraft;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
    else if (restoreFocusRef.current) {
      triggerRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [editing]);

  const setDraft = (next: string): void => {
    writeQuickEdit(quickEditMemory, item, next, setLocalDraft);
  };
  const close = (): void => {
    restoreFocusRef.current = true;
    quickEditMemory?.write(item, null);
    setLocalDraft(item.text);
    setLocalEditing(false);
  };

  const commit = () => {
    close();
    submitQuickEdit(item, draft, onQuickEditText);
  };

  if (editing) {
    return (
      <StatusOverviewQuickEditForm
        draft={draft}
        item={item}
        onCancel={close}
        onChange={setDraft}
        onSave={onQuickEditText ? commit : undefined}
        textareaRef={textareaRef}
      />
    );
  }

  const textClassName = previewTextClassName(expanded, canCollapse);
  const editTarget = item.editTarget;
  const canonicalTitle =
    onQuickEditText === undefined &&
    onEditItem !== undefined &&
    editTarget !== null &&
    !editTarget.focusNextStep &&
    item.resolution == null &&
    item.workflowStatus !== "done";
  return (
    <div className="min-w-0">
      {onQuickEditText ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setDraft(item.text);
            setLocalEditing(true);
          }}
          className={`${textClassName} -mx-1 w-[calc(100%+0.5rem)] rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]`}
        >
          <span className="sr-only">Quick edit</span> {item.text}
        </button>
      ) : canonicalTitle ? (
        <button
          type="button"
          data-overview-focus={`title:${item.source}:${item.stableId ?? item.key}`}
          onClick={() => onEditItem(editTarget)}
          className={`${textClassName} min-h-[var(--touch-target-min)] -mx-1 w-[calc(100%+0.5rem)] rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]`}
        >
          <span className="sr-only">Edit item:</span> {item.text}
        </button>
      ) : (
        <p className={textClassName}>{item.text}</p>
      )}
      <div className="mt-1 min-w-0 space-y-1">
        <PreviewMetadata item={item} />
      </div>
    </div>
  );
}

function TextDisclosure({
  item,
  expanded,
  onToggle,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  if (item.text.length <= LONG_UPDATE_LENGTH) return null;
  const label = expanded ? "Show less" : "Show full update";
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${label}: ${shortItemLabel(item.text)}`}
      onClick={onToggle}
      className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-1 text-xs text-[var(--color-primary)] underline underline-offset-4 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {label}
    </button>
  );
}

export function StatusOverviewItemPreview({
  item,
  onEditItem,
  onQuickEditText,
  quickEditMemory,
  onPlanItem,
  onMoveItem,
  onConfirmItem,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly quickEditMemory?: StatusOverviewQuickEditMemory | undefined;
  readonly onPlanItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onMoveItem?:
    | ((
        item: StatusOverviewItem,
        target: "current" | "next",
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onConfirmItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-overview-item-preview
      className="group/item min-w-0 space-y-1.5 md:flex md:h-full md:flex-col"
    >
      <PreviewText
        item={item}
        expanded={expanded}
        onEditItem={onEditItem}
        onQuickEditText={item.editTarget ? onQuickEditText : undefined}
        quickEditMemory={quickEditMemory}
      />
      <OutcomeAudit item={item} />
      <TrackedWorkComments item={item} />
      <TextDisclosure
        item={item}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      <PreviewActions
        item={item}
        onEditItem={onEditItem}
        onPlanItem={onPlanItem}
        onMoveItem={onMoveItem}
        onConfirmItem={onConfirmItem}
        onResolvePlan={onResolvePlan}
        onRestorePlan={onRestorePlan}
      />
    </div>
  );
}
