import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type ItemsEditorProps = {
  items: ReportSectionReadModel['items'];
  disabled: boolean;
  onCompletedChange: (itemIndex: number, completed: boolean) => void;
  onTextChange: (itemIndex: number, value: string) => void;
};

export function ItemsEditor({ items, disabled, onCompletedChange, onTextChange }: ItemsEditorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Items</legend>
      {items.map((item, itemIndex) => (
        <label key={item.id ?? `${item.projectId}-${item.type}-${itemIndex}`}>
          <span>{item.type === 'current' ? 'Current Week Item' : 'Next Week Item'}</span>
          {item.carriedOver ? <p>Carried over from previous report</p> : null}
          <input
            aria-label={`${item.type === 'current' ? 'Current' : 'Next'} item ${itemIndex + 1}`}
            value={item.text}
            onChange={(event) => {
              onTextChange(itemIndex, event.currentTarget.value);
            }}
          />
          {item.carriedOver ? (
            <label>
              <span>Completed</span>
              <input
                aria-label={`Carry-over item ${itemIndex + 1} completed`}
                checked={Boolean(item.completed)}
                onChange={(event) => {
                  onCompletedChange(itemIndex, event.currentTarget.checked);
                }}
                type="checkbox"
              />
            </label>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}
