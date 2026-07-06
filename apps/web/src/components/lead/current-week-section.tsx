"use client";

import { useRef } from "react";

import type { EditableListDialogState } from "../../hooks/use-editable-list-dialog";
import { useEditableListDialog } from "../../hooks/use-editable-list-dialog";
import { useScrollFade } from "../../hooks/use-scroll-fade";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product, RiskEntry } from "./mock-data";
import { buildItemColumns, isBoardEmpty } from "./next-week-columns";

const MAX_GRID_COLUMNS = 3;

interface CurrentWeekSectionProps {
  readonly items: KanbanItem[];
  /**
   * record-status-derived-from-risk: own risks forwarded to each ItemCard so
   * its at-risk/blocked pill derives from the covering risks, never a free item
   * status.
   */
  readonly risks?: readonly RiskEntry[];
  readonly readOnly?: boolean;
  /**
   * Controlled-component callback fired with the next items array on add /
   * inline-edit / delete. The parent must merge this back into its raw
   * `draftSection.items` keyed by id, preserving non-presentation fields
   * (tag, workflowStatus, carriedOver, completed, type).
   */
  readonly onItemsChange?: (items: KanbanItem[]) => void;
  /**
   * Author label used as the default `author` for newly-created items.
   * Falls back to "You" when undefined.
   */
  readonly currentUserName?: string;
  /**
   * Used as the seed product for the empty-state `+ Add` button. Without
   * this prop the section would have no per-product group to attach the
   * Add button to once all items are deleted, leaving a dead section.
   */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the author's attached activities forwarded to
   * ItemEditDialog so the parent picker can offer them alongside products.
   */
  readonly activities?: readonly { id: string; name: string }[];
  /**
   * 35-04: stages-the-lead-owns selector forwarded to ItemEditDialog so
   * the SDLC stage dropdown is scoped to the active project.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * All priority ranks already in use by own items for the full period
   * (current + next week). Forwarded to ItemEditDialog so taken ranks are
   * disabled in the picker. The dialog subtracts the edited item's own
   * current rank before computing the disabled set.
   */
  readonly ownPeriodRanks?: readonly number[];
  readonly addSignal?: number;
  /**
   * Resolve-not-delete (ADR 0015): item ids whose lineage appeared in a
   * published report — the card shows the marker and withholds Delete.
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMarkComplete?: (id: string) => void;
  /** In-place move action (same durable identity; see ItemCardActions). */
  readonly onMoveToNextWeek?: (id: string) => void;
  /**
   * Route an uncovered item's alarm gesture to blocker (risk) creation.
   * Forwarded to the item dialog.
   */
}

function deriveDialogProps(dialogState: EditableListDialogState<KanbanItem>): {
  editItem: KanbanItem | null;
  createSeedProductId: string | undefined;
} {
  const isEdit = dialogState.open && dialogState.mode === "edit";
  const isCreate = dialogState.open && dialogState.mode === "create";
  return {
    editItem: isEdit ? dialogState.entity : null,
    createSeedProductId: isCreate ? dialogState.seedProductId : undefined,
  };
}

export function CurrentWeekSection({
  items,
  risks,
  readOnly = false,
  onItemsChange,
  currentUserName,
  products,
  activities,
  stagesForProduct,
  ownPeriodRanks,
  addSignal = 0,
  publishedLockedIds,
  onMarkComplete,
  onMoveToNextWeek,
}: CurrentWeekSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canScrollDown = useScrollFade(scrollRef);

  // Only fall back to the standalone empty-state when there are neither
  // items nor products to drive a column layout.
  const isEmpty = isBoardEmpty(items, products);
  const hasMultipleProducts = products != null && products.length > 1;
  const defaultProduct = products?.[0];

  // Shared dialog lifecycle (DialogState union, D1 readOnly-ref add-signal
  // effect, D13 openSeq remount key, pending-delete). requireSeed: this
  // section can only open create mode when a product column exists.
  const {
    dialogState,
    dialogKey,
    openCreate,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  } = useEditableListDialog<KanbanItem>({
    readOnly,
    addSignal,
    seedProductId: defaultProduct?.id,
    requireSeed: true,
  });

  const globalAddButton = !readOnly && (
    <div className="flex justify-end">
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => defaultProduct && handleAdd(defaultProduct.id)}
        disabled={!defaultProduct}
        title={
          defaultProduct
            ? `Add item to ${defaultProduct.name}`
            : "No products assigned — contact admin"
        }
      >
        + Add Item
      </button>
    </div>
  );

  function handleAdd(seedProductId: string) {
    openCreate(seedProductId);
  }

  function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    requestDelete(item);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onItemsChange?.(items.filter((i) => i.id !== pendingDelete.id));
    clearPendingDelete();
  }

  function handleEdit(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    openEdit(item);
  }

  function handleDialogSave(next: KanbanItem) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onItemsChange?.([...items, next]);
    } else {
      onItemsChange?.(items.map((i) => (i.id === next.id ? next : i)));
    }
    close();
  }

  function handleDialogCancel() {
    close();
  }

  // Empty-state: when no items exist there are no per-product groups to
  // hang the `+ Add` button on, so render a stand-alone CTA seeded from
  // the first product. Without this the section reads as a dead band.
  if (isEmpty) {
    if (readOnly) {
      return (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No current-week items.
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No current-week items yet.
        </p>
        {globalAddButton}
      </div>
    );
  }

  // Render one column per assigned product (not per non-empty group), so
  // that products with zero items still surface a `+ Add` CTA in their
  // column. Falls back to non-empty groups when `products` isn't passed
  // (defensive — the prop became required de-facto in May 2026 but
  // existing callers may still omit it).
  const columns = buildItemColumns(products, items);
  const dlg = deriveDialogProps(dialogState);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-focusable (axe scrollable-region-focusable); the static rule does not model that WCAG exception
        tabIndex={0}
        role="group"
        aria-label="Current week items"
        className="max-h-[420px] overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(columns.length, 1), MAX_GRID_COLUMNS)}, minmax(0, 1fr))`,
          }}
        >
          {columns.map((col) => (
            <div key={col.key} className="min-w-0">
              {/* gap-2 (not justify-between) keeps the `+ Add` button glued
                next to the product label so the header reads as a tight
                unit even when the column is wide. */}
              <div className="mb-3 flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 truncate font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                  {col.productName}
                </div>
                {!readOnly && hasMultipleProducts && (
                  <button
                    type="button"
                    className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[28px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1.5 md:px-2.5 md:py-0.5 text-[11px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                    onClick={() => handleAdd(col.productId)}
                    aria-label={`Add item to ${col.productName}`}
                  >
                    + Add
                  </button>
                )}
              </div>
              {col.items.length === 0 ? (
                <div
                  className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[var(--color-surface-hover)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
                  style={{ minHeight: 150 }}
                >
                  No items yet
                </div>
              ) : (
                <div className="space-y-2">
                  {col.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      risks={risks}
                      readOnly={readOnly}
                      isEditing={false}
                      publishedLocked={publishedLockedIds?.has(item.id)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onMarkComplete={onMarkComplete}
                      onMoveToNextWeek={onMoveToNextWeek}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Edit / Add modal — single instance shared across all columns. */}
        <ItemEditDialog
          key={dialogKey}
          open={dialogState.open}
          item={dlg.editItem}
          products={products ?? []}
          activities={activities}
          week="current"
          currentUserName={currentUserName}
          defaultProductId={dlg.createSeedProductId}
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
          risks={risks}
          onSave={handleDialogSave}
          onCancel={handleDialogCancel}
        />

        <ConfirmDeleteDialog
          open={pendingDelete !== null}
          title="Delete item?"
          preview={pendingDelete?.text ?? ""}
          subtitle={
            pendingDelete ? `From ${pendingDelete.productName}` : undefined
          }
          onConfirm={confirmDelete}
          onCancel={clearPendingDelete}
        />
      </div>
      {canScrollDown && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 rounded-b-lg"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-card))",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
