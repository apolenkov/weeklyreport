"use client";

import { useRef } from "react";

import { createEditableListHandlers } from "../../../shared/hooks/dialogs/create-editable-list-handlers";
import { useEditableListDialog } from "../../../shared/hooks/dialogs/use-editable-list-dialog";
import type { KanbanItem, Product } from "../../report-sections";
import {
  BoardEmptyState,
  BoardGrid,
  buildItemDialogProps,
  isBoardEmpty,
  ItemCard,
  ItemDialogStack,
  splitItemBoard,
} from "../../report-sections";
import { usePauseReason } from "../model/controls/use-pause-reason";
import { useScrollFade } from "../model/controls/use-scroll-fade";
import { AddItemButton } from "./current-week-add-button";
import type { CurrentWeekSectionProps } from "./current-week-section.types";
import { PauseReasonDialog } from "./pause-reason-dialog";
type CurrentWeekItemHandlers = ReturnType<
  typeof createEditableListHandlers<KanbanItem>
>;
type PauseReasonPrompt = ReturnType<typeof usePauseReason<KanbanItem>>;

// Bind a card renderer to this section's props; the grid calls it per item.
function createItemRenderer({
  props,
  handlers,
  pause,
}: {
  readonly props: CurrentWeekSectionProps;
  readonly handlers: CurrentWeekItemHandlers;
  readonly pause: PauseReasonPrompt;
}) {
  return (item: KanbanItem) => (
    <ItemCard
      key={item.id}
      item={item}
      risks={props.risks}
      readOnly={props.readOnly ?? false}
      publishedLocked={props.publishedLockedIds?.has(item.id)}
      onEdit={handlers.handleEdit}
      onDelete={handlers.handleDelete}
      onMarkComplete={props.onMarkComplete}
      onMoveToNextWeek={props.onMoveToNextWeek}
      {...(props.onPauseItem && !props.readOnly
        ? { onPause: () => pause.request(item) }
        : {})}
    />
  );
}

// Without a stand-alone CTA the emptied section would be dead — there would be
// no product column left to host a `+ Add`.
function CurrentWeekEmptyState({
  readOnly,
  defaultProduct,
  onCreate,
}: {
  readonly readOnly: boolean;
  readonly defaultProduct: Product | undefined;
  readonly onCreate: (seed: { productId: string }) => void;
}) {
  return (
    <BoardEmptyState
      readOnly={readOnly}
      readOnlyLabel="No current-week items."
      editableLabel="No current-week items yet."
      addButton={
        !readOnly && (
          <AddItemButton
            defaultProduct={defaultProduct}
            onAdd={(productId) => onCreate({ productId })}
          />
        )
      }
    />
  );
}

// Signals that the scroll container still has content below the fold.
function ScrollFadeOverlay() {
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 rounded-b-lg"
      style={{
        background:
          "linear-gradient(to bottom, transparent, var(--color-card))",
      }}
      aria-hidden="true"
    />
  );
}

export function CurrentWeekSection(props: CurrentWeekSectionProps) {
  const { items, products, activities } = props;
  const { readOnly = false, addSignal = 0 } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const canScrollDown = useScrollFade(scrollRef);

  // The pause-reason prompt lifecycle lives in a hook so
  // a card's Pause button only needs to name the item.
  const pause = usePauseReason<KanbanItem>(props.onPauseItem);
  const defaultProduct = products[0];
  const defaultActivityId = defaultProduct ? undefined : activities?.[0]?.id;

  // Shared dialog lifecycle (DialogState union, readOnly-ref add-signal
  // effect, openSeq remount key, pending-delete). requireSeed: this section
  // can only open create mode when a product column exists.
  const dialog = useEditableListDialog<KanbanItem>({
    readOnly,
    addSignal,
    seedProductId: defaultProduct?.id,
    seedActivityId: defaultActivityId,
    requireSeed: true,
  });

  const handlers = createEditableListHandlers(props, dialog);

  // Only fall back to the standalone empty-state when there are neither
  // items nor products to drive a column layout.
  if (isBoardEmpty(items, products, activities)) {
    return (
      <CurrentWeekEmptyState
        readOnly={readOnly}
        defaultProduct={defaultProduct}
        onCreate={dialog.openCreate}
      />
    );
  }

  // One column per assigned product (including empty) so `+ Add` stays visible.
  // Activity lanes sit below the grid, never as peer product columns.
  const board = splitItemBoard(products, items, activities);
  const dialogProps = buildItemDialogProps({
    section: props,
    dialog,
    handlers,
    week: "current",
  });

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="group"
        aria-label="Current week items"
        className="max-md:max-h-none max-md:overflow-visible md:max-h-[420px] md:overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <BoardGrid
          productColumns={board.productColumns}
          activityLanes={board.activityLanes}
          readOnly={readOnly}
          hasMultipleProducts={products.length > 1}
          onAdd={dialog.openCreate}
          renderItem={createItemRenderer({ props, handlers, pause })}
        />

        <ItemDialogStack
          {...dialogProps}
          pauseDialog={
            <PauseReasonDialog
              open={pause.pending !== null}
              preview={pause.pending?.text ?? ""}
              initialReason={pause.pending?.pausedReason ?? ""}
              onConfirm={pause.confirm}
              onCancel={pause.cancel}
            />
          }
        />
      </div>
      {canScrollDown && <ScrollFadeOverlay />}
    </div>
  );
}
