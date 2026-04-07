import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type ItemsEditorProps = {
  items: ReportSectionReadModel['items'];
  disabled: boolean;
  onTextChange: (itemIndex: number, value: string) => void;
};

export function ItemsEditor({ items, disabled, onTextChange }: ItemsEditorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Items</legend>
      {items.map((item, itemIndex) => (
        <label key={item.id ?? `${item.projectId}-${item.type}-${itemIndex}`}>
          <span>{item.type === 'current' ? 'Current Week Item' : 'Next Week Item'}</span>
          <input
            aria-label={`${item.type === 'current' ? 'Current' : 'Next'} item ${itemIndex + 1}`}
            value={item.text}
            onChange={(event) => {
              onTextChange(itemIndex, event.currentTarget.value);
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
