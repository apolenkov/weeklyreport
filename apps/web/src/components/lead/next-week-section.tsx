'use client';

import { useState } from 'react';

import { ItemCard } from './item-card';
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
}: NextWeekSectionProps) {
  const grouped = groupByProduct(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEmpty = grouped.size === 0 && (!products || products.length === 0);

  function handleAdd(seed: KanbanItem) {
    if (readOnly) return;
    const newItem: KanbanItem = {
      id: crypto.randomUUID(),
      productId: seed.productId,
      productName: seed.productName,
      ...(seed.stageName ? { stageName: seed.stageName } : {}),
      text: '',
      status: 'planned',
      author: currentUserName ?? 'You',
    };
    onItemsChange?.([...items, newItem]);
    setEditingId(newItem.id);
  }

  function handleDelete(id: string) {
    if (readOnly) return;
    onItemsChange?.(items.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function handleEdit(id: string) {
    if (readOnly) return;
    setEditingId(id);
  }

  function handleTextSave(id: string, nextText: string) {
    if (readOnly) {
      setEditingId(null);
      return;
    }
    onItemsChange?.(
      items.map((i) => (i.id === id ? { ...i, text: nextText } : i)),
    );
    setEditingId(null);
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
          onClick={() => {
            if (!product) return;
            handleAdd({
              id: 'seed',
              productId: product.id,
              productName: product.name,
              status: 'planned',
              text: '',
              author: currentUserName ?? 'You',
            });
          }}
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
      : [...grouped.entries()].map(([productName, gItems]) => ({
          key: productName,
          productId: gItems[0]!.productId,
          productName: gItems[0]!.productName,
          items: gItems,
        }));

  return (
    <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 1fr)` }}>
        {columns.map((col) => (
          <div key={col.key}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                {col.productName}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="btn-press inline-flex min-h-[34px] flex-shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                  onClick={() => handleAdd({
                    id: 'seed',
                    productId: col.productId,
                    productName: col.productName,
                    status: 'planned',
                    text: '',
                    author: currentUserName ?? 'You',
                  })}
                  aria-label={`Add item to ${col.productName}`}
                >
                  + Add
                </button>
              )}
            </div>
            {col.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#f8f6f2] p-3 text-center text-xs text-[var(--color-muted-foreground)]">
                No items yet
              </div>
            ) : (
              <div className="space-y-2">
                {col.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    readOnly={readOnly}
                    isEditing={editingId === item.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onTextSave={handleTextSave}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
