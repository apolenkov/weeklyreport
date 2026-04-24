'use client';

import { ItemCard } from './item-card';
import type { KanbanItem } from './mock-data';

type CurrentWeekSectionProps = {
  readonly items: KanbanItem[];
  readonly readOnly?: boolean;
};

function groupByProduct(items: KanbanItem[]): Map<string, KanbanItem[]> {
  const map = new Map<string, KanbanItem[]>();
  for (const item of items) {
    const key = item.stageName
      ? `${item.productName} \u00b7 ${item.stageName}`
      : item.productName;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export function CurrentWeekSection({ items, readOnly = false }: CurrentWeekSectionProps) {
  const grouped = groupByProduct(items);

  return (
    <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[...grouped.entries()].map(([groupName, groupItems]) => (
          <div key={groupName}>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-[family-name:var(--font-sans)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
                {groupName}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="btn-press inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.18)] bg-[rgba(0,117,74,0.08)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary)] transition-colors hover:border-[rgba(0,117,74,0.28)] hover:bg-[var(--color-success)]"
                >
                  + Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {groupItems.map((item) => (
                <ItemCard key={item.id} item={item} readOnly={readOnly} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
