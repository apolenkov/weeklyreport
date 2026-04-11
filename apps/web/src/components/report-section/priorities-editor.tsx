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
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined} role="group" aria-label="Top 3 Priorities">
      <div className="space-y-3">
        {priorities.map((priority) => (
          <div key={priority.rank} className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
              {priority.rank}
            </span>
            <div className="flex-1 space-y-1">
              <Label htmlFor={`priority-${priority.rank}`}>
                Priority {priority.rank}
              </Label>
              <Input
                id={`priority-${priority.rank}`}
                aria-label={`Priority ${priority.rank}`}
                value={priority.text}
                onChange={(event) => {
                  onChange(priority.rank, event.currentTarget.value);
                }}
                disabled={disabled}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
