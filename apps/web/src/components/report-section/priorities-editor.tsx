'use client';

import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button, ConfirmDialog, Input } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type PrioritiesEditorProps = {
  priorities: ReportSectionReadModel['priorities'];
  disabled: boolean;
  onChange: (rank: number, value: string) => void;
  onAdd?: () => void;
  onRemove?: (rank: number) => void;
};

const rankColors = [
  'bg-primary text-primary-foreground',
  'bg-primary/80 text-primary-foreground',
  'bg-primary/60 text-primary-foreground',
  'bg-primary/50 text-primary-foreground',
  'bg-primary/40 text-primary-foreground',
];

export function PrioritiesEditor({ priorities, disabled, onChange, onAdd, onRemove }: PrioritiesEditorProps) {
  const [pendingDeleteRank, setPendingDeleteRank] = useState<number | null>(null);

  function handleConfirmDelete() {
    if (pendingDeleteRank !== null && onRemove) {
      onRemove(pendingDeleteRank);
      setPendingDeleteRank(null);
    }
  }

  return (
    <div
      className={disabled ? 'pointer-events-none opacity-50' : undefined}
      role="group"
      aria-label="Priorities"
    >
      <div className="stagger-children space-y-3">
        {priorities.map((priority, index) => (
          <div
            key={priority.rank}
            className="group flex items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/30" />
            <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-bold ${rankColors[index] ?? rankColors[rankColors.length - 1]}`}>
              {priority.rank}
            </span>
            <div className="flex-1">
              <Input
                id={`priority-${priority.rank}`}
                aria-label={`Priority ${priority.rank}`}
                value={priority.text}
                placeholder={`Enter priority ${priority.rank}...`}
                onChange={(event) => {
                  onChange(priority.rank, event.currentTarget.value);
                }}
                disabled={disabled}
                className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
            {!disabled && onRemove && priorities.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 size-8 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                onClick={() => setPendingDeleteRank(priority.rank)}
                aria-label={`Remove priority ${priority.rank}`}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {!disabled && onAdd ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
          onClick={onAdd}
        >
          <Plus className="size-4" />
          Add Priority
        </Button>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteRank !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteRank(null); }}
        title="Remove Priority"
        description="This priority will be removed from your report. Continue?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
