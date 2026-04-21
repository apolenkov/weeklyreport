'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

import { Button, ConfirmDialog, Input, Label } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type RisksEditorProps = {
  risks: ReportSectionReadModel['risks'];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onFieldChange: (index: number, field: 'risk' | 'impact' | 'mitigation', value: string) => void;
};

export function RisksEditor({ risks, disabled, onAdd, onRemove, onFieldChange }: RisksEditorProps) {
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  function handleConfirmDelete() {
    if (pendingDeleteIndex !== null) {
      onRemove(pendingDeleteIndex);
      setPendingDeleteIndex(null);
    }
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Risks">
      {risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
          <AlertTriangle className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No active risks</p>
        </div>
      ) : (
        <div className="stagger-children space-y-3">
          {risks.map((risk, index) => (
            <div
              key={risk.id ?? `risk-${index}`}
              className="group space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 transition-colors hover:border-destructive/30"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`risk-text-${index}`} className="text-xs text-muted-foreground">
                      Risk description
                    </Label>
                    <Input
                      id={`risk-text-${index}`}
                      value={risk.risk}
                      placeholder="Describe the risk..."
                      onChange={(e) => onFieldChange(index, 'risk', e.currentTarget.value)}
                      disabled={disabled}
                      className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-destructive focus-visible:ring-0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`risk-impact-${index}`} className="text-xs text-muted-foreground">
                        Impact
                      </Label>
                      <Input
                        id={`risk-impact-${index}`}
                        value={risk.impact}
                        placeholder="High / Medium / Low"
                        onChange={(e) => onFieldChange(index, 'impact', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-destructive focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`risk-mitigation-${index}`} className="text-xs text-muted-foreground">
                        Mitigation
                      </Label>
                      <Input
                        id={`risk-mitigation-${index}`}
                        value={risk.mitigation}
                        placeholder="How to mitigate..."
                        onChange={(e) => onFieldChange(index, 'mitigation', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none transition-colors focus-visible:border-destructive focus-visible:ring-0"
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
                    aria-label={`Remove risk ${index + 1}`}
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
          className="mt-3 gap-1.5 transition-colors hover:border-destructive/30 hover:bg-destructive/5"
          onClick={onAdd}
        >
          <Plus className="size-4" />
          Add Risk
        </Button>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteIndex(null); }}
        title="Remove Risk"
        description="This risk entry will be removed from your report. Continue?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
