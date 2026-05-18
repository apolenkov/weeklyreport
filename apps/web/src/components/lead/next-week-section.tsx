"use client";

import { useEffect, useState } from "react";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product } from "./mock-data";
import { splitStageNames } from "./stage-tags";

type NextWeekSectionProps = {
  readonly items: KanbanItem[];
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
  /** 35-04: forwarded to ItemEditDialog for the SDLC stage selector. */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly addSignal?: number;
};

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  const map = new Map<string, KanbanItem[]>();
  for (const item of items) {
    const tags =
      item.stageIds && item.stageIds.length > 0
        ? item.stageIds
        : splitStageNames(item.stageName);
    const key =
      tags.length > 0
        ? `${item.productName} · ${tags.join(", ")}`
        : item.productName;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export function NextWeekSection({
  items,
  readOnly = false,
  onItemsChange,
  currentUserName,
  products,
  stagesForProduct,
  addSignal = 0,
}: NextWeekSectionProps) {
  const grouped = groupByProduct(items);
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "create"; seedProductId: string }
    | { open: true; mode: "edit"; item: KanbanItem }
  >({ open: false });
  // D-13: monotonic counter so repeated opens of the same item get a fresh
  // key even when item.id is unchanged (prevents stale stageIds in dialog).
  const [openSeq, setOpenSeq] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<KanbanItem | null>(null);
  const isEmpty = grouped.size === 0 && (!products || products.length === 0);
  const hasProducts = products && products.length > 0;
  const hasMultipleProducts = hasProducts && products.length > 1;
  const defaultProduct = products?.[0];
  const defaultProductId = defaultProduct?.id;

  const globalAddButton = !readOnly && (
    <div className="flex justify-end">
      <button
        type="button"
        className="btn-press inline-flex min-h-[40px] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => defaultProduct && handleAdd(defaultProduct.id)}
        disabled={!hasProducts}
        title={hasProducts ? `Add item to ${defaultProduct?.name}` : "No products assigned — contact admin"}
      >
        + Add Item
      </button>
    </div>
  );

  function handleAdd(seedProductId: string) {
    if (readOnly) return;
    setOpenSeq((n) => n + 1);
    setDialogState({ open: true, mode: "create", seedProductId });
  }

  useEffect(() => {
    if (addSignal === 0) return;
    if (readOnly || !defaultProductId) return;
    setOpenSeq((n) => n + 1);
    setDialogState({ open: true, mode: "create", seedProductId: defaultProductId });
  }, [addSignal, defaultProductId, readOnly]);

  function handleDelete(id: string) {
    if (readOnly) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setPendingDelete(item);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onItemsChange?.(items.filter((i) => i.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  function handleEdit(id: string) {
    if (readOnly) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setOpenSeq((n) => n + 1);
    setDialogState({ open: true, mode: "edit", item });
  }

  function handleDialogSave(next: KanbanItem) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onItemsChange?.([...items, next]);
    } else {
      onItemsChange?.(items.map((i) => (i.id === next.id ? next : i)));
    }
    setDialogState({ open: false });
  }

  function handleDialogCancel() {
    setDialogState({ open: false });
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

  // Render one column per assigned product so empty products still get a
  // "+ Add" CTA in their column. Falls back to grouped items when
  // `products` is not supplied.
  const columns: {
    key: string;
    productId: string;
    productName: string;
    items: KanbanItem[];
  }[] =
    products && products.length > 0
      ? products.map((p) => ({
          key: p.name,
          productId: p.id,
          productName: p.name,
          items: items.filter((it) => it.productId === p.id),
        }))
      : [...grouped.entries()].flatMap(([productName, gItems]) => {
          const first = gItems[0];
          if (!first) return [];
          return [
            {
              key: productName,
              productId: first.productId,
              productName: first.productName,
              items: gItems,
            },
          ];
        });
  const visibleColumnCount = Math.min(Math.max(columns.length, 1), 3);

  return (
    <div
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
            {col.items.length === 0 ? (
              <div
                className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[var(--color-surface-hover)] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
                style={{ minHeight: 110 }}
              >
                No items yet
              </div>
            ) : (
              <div className="space-y-2">
                {col.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    readOnly={readOnly}
                    isEditing={false}
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
        key={`${openSeq}-${dialogState.open && dialogState.mode === "edit" ? dialogState.item.id : "new"}`}
        open={dialogState.open}
        item={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.item
            : null
        }
        products={products ?? []}
        week="next"
        currentUserName={currentUserName}
        defaultProductId={
          dialogState.open && dialogState.mode === "create"
            ? dialogState.seedProductId
            : undefined
        }
        stagesForProduct={stagesForProduct}
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
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
