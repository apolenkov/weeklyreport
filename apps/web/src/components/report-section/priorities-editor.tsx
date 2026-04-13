'use client';

import { Input } from '@customreport/ui';

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
      <div className="stagger-children space-y-3">
        {priorities.map((priority) => (
          <div key={priority.rank} className="flex items-start gap-4 rounded-xl border bg-card p-5">
            <span className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
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
                className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
