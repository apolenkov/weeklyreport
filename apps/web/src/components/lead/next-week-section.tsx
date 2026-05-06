'use client';

import { useState } from 'react';

import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { ItemCard } from './item-card';
import { ItemEditDialog } from './item-edit-dialog';
import type { KanbanItem, Product } from './mock-data';

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
};

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  const map = new Map<string, KanbanItem[]>();
  for (const item of items) {
    const key = item.productName;
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
}: NextWeekSectionProps) {
  const grouped = groupByProduct(items);
  const [dialogState, setDialogState] = useState<
    { open: false } | { open: true; mode: 'create'; seedProductId: string } | { open: true; mode: 'edit'; item: KanbanItem }
  >({ open: false });
  const [pendingDelete, setPendingDelete] = useState<KanbanItem | null>(null);
  const isEmpty = grouped.size === 0 && (!products || products.length === 0);

  function handleAdd(seedProductId: string) {
    if (readOnly) return;
    setDialogState({ open: true, mode: 'create', seedProductId });
  }

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
    setDialogState({ open: true, mode: 'edit', item });
  }

  function handleDialogSave(next: KanbanItem) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === 'create') {
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
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[#f8f6f2] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No next-week items.
        </div>
      );
    }
    const product = products?.[0];
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[#f8f6f2] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No next-week items yet.
        </p>
        <button
          type="button"
          className="btn-press inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.25)] bg-[rgba(0,117,74,0.08)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => product && handleAdd(product.id)}
          disabled={!product}
          aria-label="Add first next-week item"
          title={product ? undefined : 'No products assigned — contact admin'}
        >
          + Add Item
        </button>
      </div>
    );
  }

  // Render one column per assigned product so empty products still get a
  // "+ Add" CTA in their column. Falls back to grouped items when
  // `products` is not supplied.
  const columns: { key: string; productId: string; productName: string; items: KanbanItem[] }[] =
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

  return (
    <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
        {columns.map((col) => (
          <div key={col.key}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1 truncate font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                {col.productName}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  // KB-5 (Phase 33-04): bumped to min-h 44 to satisfy the
                  // global tap-target rule (mockup spec); padding tightened so
                  // the chip still reads like an inline action, not a CTA bar.
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                  onClick={() => handleAdd(col.productId)}
                  aria-label={`Add item to ${col.productName}`}
                >
                  + Add
                </button>
              )}
            </div>
            {col.items.length === 0 ? (
              <div
                className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#f8f6f2] p-3 text-center text-xs text-[var(--color-muted-foreground)]"
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
        open={dialogState.open}
        item={dialogState.open && dialogState.mode === 'edit' ? dialogState.item : null}
        products={products ?? []}
        week="next"
        currentUserName={currentUserName}
        defaultProductId={dialogState.open && dialogState.mode === 'create' ? dialogState.seedProductId : undefined}
        stagesForProduct={stagesForProduct}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete next-week item?"
        preview={pendingDelete?.text ?? ''}
        subtitle={pendingDelete ? `From ${pendingDelete.productName}` : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
