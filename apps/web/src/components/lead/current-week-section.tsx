"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCard } from "./item-card";
import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product } from "./mock-data";
import { splitStageNames } from "./stage-tags";

interface CurrentWeekSectionProps {
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
  /**
   * Used as the seed product for the empty-state `+ Add` button. Without
   * this prop the section would have no per-product group to attach the
   * Add button to once all items are deleted, leaving a dead section.
   */
  readonly products?: readonly Product[];
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
}

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  const map = new Map<string, KanbanItem[]>();
  for (const item of items) {
    const tags =
      item.stageIds && item.stageIds.length > 0
        ? item.stageIds
        : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
          splitStageNames(item.stageName);
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

export function CurrentWeekSection({
  items,
  readOnly = false,
  onItemsChange,
  currentUserName,
  products,
  stagesForProduct,
  ownPeriodRanks,
  addSignal = 0,
}: CurrentWeekSectionProps) {
  const grouped = groupByProduct(items);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function check() {
      if (!el) return;
      setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    }
    check();
    el.addEventListener("scroll", check, { passive: true });
    // ResizeObserver may be absent in SSR / test (jsdom) environments.
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
    };
  }, []);

  // null = create mode (Add); KanbanItem = edit mode for that row.
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "create"; seedProductId: string }
    | { open: true; mode: "edit"; item: KanbanItem }
  >({ open: false });
  // D-13: monotonic counter so repeated opens of the same item get a fresh
  // key even when item.id is unchanged (prevents stale stageIds in dialog).
  const [openSeq, setOpenSeq] = useState(0);
  // Pending-delete state for the M20 confirmation modal — prevents
  // accidental data loss on a stray click. The actual filter+emit
  // happens only after the user confirms.
  const [pendingDelete, setPendingDelete] = useState<KanbanItem | null>(null);
  // Only fall back to the standalone empty-state when there are neither
  // items nor products to drive a column layout.
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
        title={
          hasProducts
            ? `Add item to ${defaultProduct?.name}`
            : "No products assigned — contact admin"
        }
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
    setDialogState({
      open: true,
      mode: "create",
      seedProductId: defaultProductId,
    });
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
      : [...grouped.entries()].flatMap(([groupName, gItems]) => {
          const first = gItems[0];
          if (!first) return [];
          return [
            {
              key: groupName,
              productId: first.productId,
              productName: first.productName,
              items: gItems,
            },
          ];
        });
  const visibleColumnCount = Math.min(Math.max(columns.length, 1), 3);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
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
                    className="btn-press inline-flex min-h-[28px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
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

        {/* Edit / Add modal — single instance shared across all columns. */}
        <ItemEditDialog
          key={`${openSeq}-${dialogState.open && dialogState.mode === "edit" ? dialogState.item.id : "new"}`}
          open={dialogState.open}
          item={
            dialogState.open && dialogState.mode === "edit"
              ? dialogState.item
              : null
          }
          products={products ?? []}
          week="current"
          currentUserName={currentUserName}
          defaultProductId={
            dialogState.open && dialogState.mode === "create"
              ? dialogState.seedProductId
              : undefined
          }
          stagesForProduct={stagesForProduct}
          ownPeriodRanks={ownPeriodRanks}
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
          onCancel={() => setPendingDelete(null)}
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
