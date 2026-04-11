'use client';

import { Badge, Input, Label, Separator } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type ItemsEditorProps = {
  items: ReportSectionReadModel['items'];
  disabled: boolean;
  onCompletedChange: (itemIndex: number, completed: boolean) => void;
  onTextChange: (itemIndex: number, value: string) => void;
};

export function ItemsEditor({ items, disabled, onCompletedChange, onTextChange }: ItemsEditorProps) {
  const currentItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.type === 'current');

  const nextItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.type === 'next');

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined} role="group" aria-label="Items">
      {/* Current Week */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Current Week</p>
        {currentItems.map(({ item, originalIndex }) => (
          <div key={item.id ?? `${item.projectId}-current-${originalIndex}`} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor={`item-${originalIndex}`}>
                Current Week Item
              </Label>
              {item.carriedOver ? (
                <Badge variant="outline">Carried Over</Badge>
              ) : null}
            </div>
            <Input
              id={`item-${originalIndex}`}
              aria-label={`Current item ${originalIndex + 1}`}
              value={item.text}
              onChange={(event) => {
                onTextChange(originalIndex, event.currentTarget.value);
              }}
              disabled={disabled}
            />
            {item.carriedOver ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  aria-label={`Carry-over item ${originalIndex + 1} completed`}
                  checked={Boolean(item.completed)}
                  onChange={(event) => {
                    onCompletedChange(originalIndex, event.currentTarget.checked);
                  }}
                  className="rounded accent-primary size-4"
                  disabled={disabled}
                />
                Completed
              </label>
            ) : null}
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Next Week */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Next Week</p>
        {nextItems.map(({ item, originalIndex }) => (
          <div key={item.id ?? `${item.projectId}-next-${originalIndex}`} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor={`item-${originalIndex}`}>
                Next Week Item
              </Label>
              {item.carriedOver ? (
                <Badge variant="outline">Carried Over</Badge>
              ) : null}
            </div>
            <Input
              id={`item-${originalIndex}`}
              aria-label={`Next item ${originalIndex + 1}`}
              value={item.text}
              onChange={(event) => {
                onTextChange(originalIndex, event.currentTarget.value);
              }}
              disabled={disabled}
            />
            {item.carriedOver ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  aria-label={`Carry-over item ${originalIndex + 1} completed`}
                  checked={Boolean(item.completed)}
                  onChange={(event) => {
                    onCompletedChange(originalIndex, event.currentTarget.checked);
                  }}
                  className="rounded accent-primary size-4"
                  disabled={disabled}
                />
                Completed
              </label>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
