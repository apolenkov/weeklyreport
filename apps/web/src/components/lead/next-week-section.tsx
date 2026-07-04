"use client";

import { useEditableListDialog } from "../../hooks/use-editable-list-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product, RiskEntry } from "./mock-data";
import { buildItemColumns, isBoardEmpty } from "./next-week-columns";
import { SlideFitAdvisory } from "./slide-fit-advisory";

const MAX_GRID_COLUMNS = 3;

interface NextWeekSectionProps {
  readonly items: KanbanItem[];
  /**
   * record-status-derived-from-risk: own risks forwarded to each ItemCard so an
   * in-progress next-week item's alarm derives from covering risks, not a free
   * status. Planned items never floor (the derivation's in-progress gate).
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
  /** Used to seed empty-state `+ Add` button when no items exist. */
  readonly products?: readonly Product[];
  /** activity-first-class: attached activities forwarded to the parent picker. */
  readonly activities?: readonly { id: string; name: string }[];
  /** 35-04: forwarded to ItemEditDialog for the SDLC stage selector. */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * All priority ranks already in use by own items for the full period
   * (current + next week). Forwarded to ItemEditDialog so taken ranks are
   * disabled in the picker.
   */
  readonly ownPeriodRanks?: readonly number[];
  readonly addSignal?: number;
  /**
   * Resolve-not-delete (ADR 0015): item ids whose lineage appeared in a
   * published report — the card shows the marker and withholds Delete.
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
}

export function NextWeekSection({
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
}: NextWeekSectionProps) {
  const isEmpty = isBoardEmpty(items, products);
  const hasProducts = products && products.length > 0;
  const hasMultipleProducts = hasProducts && products.length > 1;
  const defaultProduct = products?.[0];
  const defaultProductId = defaultProduct?.id;

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
    seedProductId: defaultProductId,
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

  // Empty-state mirror of CurrentWeekSection: when no items exist we
  // surface a stand-alone CTA seeded from the first product, otherwise
  // the section ends up dead with no way to start filling it.
  if (isEmpty) {
    if (readOnly) {
      return (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No next-week items.
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No next-week items yet.
        </p>
        {globalAddButton}
      </div>
    );
  }

  const columns = buildItemColumns(products, items);
  const visibleColumnCount = Math.min(
    Math.max(columns.length, 1),
    MAX_GRID_COLUMNS,
  );

  return (
    <div
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-focusable (axe scrollable-region-focusable); the static rule does not model that WCAG exception
      tabIndex={0}
      role="group"
      aria-label="Next week items"
      className="max-h-[420px] overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${visibleColumnCount}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <div key={col.key}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1 truncate font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                {col.productName}
              </div>
              {!readOnly && hasMultipleProducts && (
                <button
                  type="button"
                  // KB-5 (Phase 33-04): mobile keeps 44px tap-target for a11y;
                  // md+ (≥768px) matches Current Week etalon at 28px (UAT v8.3).
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[28px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1.5 md:px-2.5 md:py-0.5 text-[11px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                  onClick={() => handleAdd(col.productId)}
                  aria-label={`Add item to ${col.productName}`}
                >
                  + Add
                </button>
              )}
            </div>
            <SlideFitAdvisory count={col.items.length} />
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
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ItemEditDialog
        key={dialogKey}
        open={dialogState.open}
        item={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity
            : null
        }
        products={products ?? []}
        activities={activities}
        week="next"
        currentUserName={currentUserName}
        defaultProductId={
          dialogState.open && dialogState.mode === "create"
            ? dialogState.seedProductId
            : undefined
        }
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete next-week item?"
        preview={pendingDelete?.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.productName}` : undefined
        }
        onConfirm={confirmDelete}
        onCancel={clearPendingDelete}
      />
    </div>
  );
}
