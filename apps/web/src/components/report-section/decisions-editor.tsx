'use client';

import { useState } from 'react';
import { CircleDot, Plus, Trash2 } from 'lucide-react';

import { Button, ConfirmDialog, Input, Label } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type DecisionsEditorProps = {
  decisions: ReportSectionReadModel['decisions'];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onFieldChange: (index: number, field: 'text' | 'owner' | 'impact', value: string) => void;
};

export function DecisionsEditor({ decisions, disabled, onAdd, onRemove, onFieldChange }: DecisionsEditorProps) {
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  function handleConfirmDelete() {
    if (pendingDeleteIndex !== null) {
      onRemove(pendingDeleteIndex);
      setPendingDeleteIndex(null);
    }
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Decisions">
      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
          <CircleDot className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No decisions pending</p>
        </div>
      ) : (
        <div className="stagger-children space-y-3">
          {decisions.map((decision, index) => (
            <div
              key={decision.id ?? `decision-${index}`}
              className="group space-y-3 rounded-lg border border-warning/20 bg-warning/5 p-4 transition-colors hover:border-warning/30"
            >
              <div className="flex items-start gap-3">
                <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`decision-text-${index}`} className="text-xs text-muted-foreground">
                      Decision
                    </Label>
                    <Input
                      id={`decision-text-${index}`}
                      value={decision.text}
                      placeholder="What needs management decision..."
                      onChange={(e) => onFieldChange(index, 'text', e.currentTarget.value)}
                      disabled={disabled}
                      className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-warning focus-visible:ring-0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`decision-owner-${index}`} className="text-xs text-muted-foreground">
                        Owner
                      </Label>
                      <Input
                        id={`decision-owner-${index}`}
                        value={decision.owner}
                        placeholder="Who decides"
                        onChange={(e) => onFieldChange(index, 'owner', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-warning focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`decision-impact-${index}`} className="text-xs text-muted-foreground">
                        Impact if unresolved
                      </Label>
                      <Input
                        id={`decision-impact-${index}`}
                        value={decision.impact}
                        placeholder="What happens if not resolved"
                        onChange={(e) => onFieldChange(index, 'impact', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-warning focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>
                {!disabled ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                    onClick={() => setPendingDeleteIndex(index)}
                    aria-label={`Remove decision ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 transition-colors hover:border-warning/30 hover:bg-warning/5"
          onClick={onAdd}
        >
          <Plus className="size-4" />
          Add Decision
        </Button>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteIndex(null); }}
        title="Remove Decision"
        description="This decision entry will be removed from your report. Continue?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
