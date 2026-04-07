import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type PrioritiesEditorProps = {
  priorities: ReportSectionReadModel['priorities'];
  disabled: boolean;
  onChange: (rank: number, value: string) => void;
};

export function PrioritiesEditor({ priorities, disabled, onChange }: PrioritiesEditorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Top 3 Priorities</legend>
      {priorities.map((priority) => (
        <label key={priority.rank}>
          <span>Priority {priority.rank}</span>
          <input
            aria-label={`Priority ${priority.rank}`}
            value={priority.text}
            onChange={(event) => {
              onChange(priority.rank, event.currentTarget.value);
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
