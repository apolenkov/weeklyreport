'use client';

import { Input, Label } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type PrioritiesEditorProps = {
  priorities: ReportSectionReadModel['priorities'];
  disabled: boolean;
  onChange: (rank: number, value: string) => void;
};

export function PrioritiesEditor({ priorities, disabled, onChange }: PrioritiesEditorProps) {
  return (
    <div
      className={disabled ? 'pointer-events-none opacity-50' : undefined}
      role="group"
      aria-label="Top 3 Priorities"
    >
      <div className="space-y-3">
        {priorities.map((priority) => (
          <div key={priority.rank} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {priority.rank}
            </span>
            <div className="flex-1 space-y-1">
              <Label htmlFor={`priority-${priority.rank}`} className="text-xs text-muted-foreground">
                Priority {priority.rank}
              </Label>
              <Input
                id={`priority-${priority.rank}`}
                aria-label={`Priority ${priority.rank}`}
                value={priority.text}
                placeholder={`Enter priority ${priority.rank}...`}
                onChange={(event) => {
                  onChange(priority.rank, event.currentTarget.value);
                }}
                disabled={disabled}
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
