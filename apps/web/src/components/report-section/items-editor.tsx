'use client';

import { ListOrdered, Plus, Trash2 } from 'lucide-react';

import { Badge, Button, Input, Label, Separator } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type ItemsEditorProps = {
  items: ReportSectionReadModel['items'];
  disabled: boolean;
  onCompletedChange: (itemIndex: number, completed: boolean) => void;
  onTextChange: (itemIndex: number, value: string) => void;
  onAdd: (type: 'current' | 'next') => void;
  onRemove: (itemIndex: number) => void;
};

export function ItemsEditor({ items, disabled, onCompletedChange, onTextChange, onAdd, onRemove }: ItemsEditorProps) {
  const currentItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.type === 'current');

  const nextItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.type === 'next');

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Items">
      {/* Current Week */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold">Current Week</span>
          <Badge variant="secondary" className="text-xs">{currentItems.length}</Badge>
        </div>
        <div className="stagger-children space-y-3 pl-4">
          {currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
              <ListOrdered className="mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No current week items</p>
            </div>
          ) : null}
          {currentItems.map(({ item, originalIndex }) => (
            <div
              key={item.id ?? `${item.projectId}-current-${originalIndex}`}
              className="flex items-start gap-3 rounded-lg border bg-card p-4"
            >
              {item.carriedOver ? (
                <input
                  type="checkbox"
                  aria-label={`Carry-over item ${originalIndex + 1} completed`}
                  checked={Boolean(item.completed)}
                  onChange={(event) => {
                    onCompletedChange(originalIndex, event.currentTarget.checked);
                  }}
                  disabled={disabled}
                  className="mt-1 size-5 shrink-0 rounded accent-primary"
                />
              ) : null}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`current-item-${originalIndex}`} className="text-sm text-muted-foreground">
                    {item.projectId ? 'Current Week' : 'Item'}
                  </Label>
                  {item.carriedOver ? (
                    <Badge variant="outline" className="text-xs">Carried Over</Badge>
                  ) : null}
                </div>
                <Input
                  id={`current-item-${originalIndex}`}
                  aria-label={`Current item ${originalIndex + 1}`}
                  value={item.text}
                  placeholder="Describe deliverable..."
                  onChange={(event) => {
                    onTextChange(originalIndex, event.currentTarget.value);
                  }}
                  disabled={disabled}
                  className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {!disabled && !item.carriedOver ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-1 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(originalIndex)}
                  aria-label={`Remove item ${originalIndex + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onAdd('current')}
            >
              <Plus className="size-4" />
              Add Item
            </Button>
          ) : null}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Next Week */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-sm font-semibold">Next Week</span>
          <Badge variant="secondary" className="text-xs">{nextItems.length}</Badge>
        </div>
        <div className="stagger-children space-y-3 pl-4">
          {nextItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
              <ListOrdered className="mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No next week items</p>
            </div>
          ) : null}
          {nextItems.map(({ item, originalIndex }) => (
            <div
              key={item.id ?? `${item.projectId}-next-${originalIndex}`}
              className="flex items-start gap-3 rounded-lg border bg-card p-4"
            >
              {item.carriedOver ? (
                <input
                  type="checkbox"
                  aria-label={`Carry-over item ${originalIndex + 1} completed`}
                  checked={Boolean(item.completed)}
                  onChange={(event) => {
                    onCompletedChange(originalIndex, event.currentTarget.checked);
                  }}
                  disabled={disabled}
                  className="mt-1 size-5 shrink-0 rounded accent-primary"
                />
              ) : null}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`next-item-${originalIndex}`} className="text-sm text-muted-foreground">
                    Next Week
                  </Label>
                  {item.carriedOver ? (
                    <Badge variant="outline" className="text-xs">Carried Over</Badge>
                  ) : null}
                </div>
                <Input
                  id={`next-item-${originalIndex}`}
                  aria-label={`Next item ${originalIndex + 1}`}
                  value={item.text}
                  placeholder="Plan for next week..."
                  onChange={(event) => {
                    onTextChange(originalIndex, event.currentTarget.value);
                  }}
                  disabled={disabled}
                  className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {!disabled && !item.carriedOver ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-1 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(originalIndex)}
                  aria-label={`Remove item ${originalIndex + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onAdd('next')}
            >
              <Plus className="size-4" />
              Add Item
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
