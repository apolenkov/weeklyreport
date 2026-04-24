import type { KanbanItem } from './mock-data';

type ItemCardProps = {
  readonly item: KanbanItem;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  readonly readOnly?: boolean;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  'in-progress': { bg: 'var(--color-success)', text: 'var(--color-primary)', label: 'In Progress' },
  completed: { bg: 'var(--color-primary)', text: '#fff', label: 'Completed' },
  blocked: { bg: '#fee2e2', text: 'var(--color-destructive)', label: 'Blocked' },
  planned: { bg: 'var(--color-muted)', text: 'var(--color-muted-foreground)', label: 'Planned' },
};

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" stroke="currentColor" fill="none" strokeWidth={2}>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE['in-progress']!;
  const isBlocked = item.status === 'blocked';
  const isPlanned = item.status === 'planned';

  return (
    <div
      className="group relative flex flex-col rounded-[10px] border bg-[var(--color-background)] p-2.5 transition-all hover:border-[rgba(0,0,0,0.2)] hover:shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
      style={{
        borderColor: isBlocked ? 'rgba(200,32,20,0.2)' : isPlanned ? 'var(--color-muted)' : 'var(--color-muted)',
        borderLeft: `3px solid ${isBlocked ? 'var(--color-destructive)' : 'var(--color-starbucks-accent)'}`,
        borderStyle: isPlanned ? 'dashed' : 'solid',
        background: isBlocked ? '#fee2e2' : 'var(--color-background)',
      }}
    >
      {/* Action buttons */}
      {!readOnly && (
        <div className="absolute right-2 top-2 flex gap-0.5 opacity-30 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)]"
            onClick={() => onEdit?.(item.id)}
            aria-label="Edit"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[#fee2e2] hover:text-[var(--color-destructive)]"
            onClick={() => onDelete?.(item.id)}
            aria-label="Delete"
          >
            <DeleteIcon />
          </button>
        </div>
      )}

      {/* Status badge */}
      <span
        className="mb-2 inline-flex w-fit items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[10px] font-semibold"
        style={{ background: badge.bg, color: badge.text }}
      >
        {badge.label}
      </span>

      {/* Item text */}
      <div className="text-sm text-[var(--color-foreground)]">{item.text}</div>

      {/* Author */}
      <div className="mt-auto pt-2 text-[11px] text-[var(--color-muted-foreground)]">
        {item.author}
      </div>
    </div>
  );
}
