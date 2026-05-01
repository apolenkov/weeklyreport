'use client';

import { useState } from 'react';

import { ItemCard } from './item-card';
import type { KanbanItem } from './mock-data';

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
}: NextWeekSectionProps) {
  const grouped = groupByProduct(items);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  return (
    <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[...grouped.entries()].map(([productName, groupItems]) => {
          const seed = groupItems[0]!;
          return (
            <div key={productName}>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                  {productName}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn-press inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                    onClick={() => handleAdd(seed)}
                    aria-label={`Add item to ${productName}`}
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {groupItems.map((item) => (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
