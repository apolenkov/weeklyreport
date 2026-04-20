'use client';

import { CircleDot, Plus, Trash2 } from 'lucide-react';

import { Button, Input, Label } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type DecisionsEditorProps = {
  decisions: ReportSectionReadModel['decisions'];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onFieldChange: (index: number, field: 'text' | 'owner' | 'impact', value: string) => void;
};

export function DecisionsEditor({ decisions, disabled, onAdd, onRemove, onFieldChange }: DecisionsEditorProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Decisions">
      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
          <CircleDot className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Нет решений, требующих внимания</p>
        </div>
      ) : (
        <div className="stagger-children space-y-3">
          {decisions.map((decision, index) => (
            <div
              key={decision.id ?? `decision-${index}`}
              className="space-y-3 rounded-lg border border-warning/20 bg-warning/5 p-4"
            >
              <div className="flex items-start gap-3">
                <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`decision-text-${index}`} className="text-xs text-muted-foreground">
                      Вопрос / решение
                    </Label>
                    <Input
                      id={`decision-text-${index}`}
                      value={decision.text}
                      placeholder="Что требует решения руководства..."
                      onChange={(e) => onFieldChange(index, 'text', e.currentTarget.value)}
                      disabled={disabled}
                      className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`decision-owner-${index}`} className="text-xs text-muted-foreground">
                        Ответственный
                      </Label>
                      <Input
                        id={`decision-owner-${index}`}
                        value={decision.owner}
                        placeholder="Кто принимает решение"
                        onChange={(e) => onFieldChange(index, 'owner', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`decision-impact-${index}`} className="text-xs text-muted-foreground">
                        Влияние при отсутствии решения
                      </Label>
                      <Input
                        id={`decision-impact-${index}`}
                        value={decision.impact}
                        placeholder="Что произойдёт, если не решить"
                        onChange={(e) => onFieldChange(index, 'impact', e.currentTarget.value)}
                        disabled={disabled}
                        className="border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>
                {!disabled ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(index)}
                    aria-label={`Удалить решение ${index + 1}`}
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
        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={onAdd}>
          <Plus className="size-4" />
          Добавить решение
        </Button>
      ) : null}
    </div>
  );
}
