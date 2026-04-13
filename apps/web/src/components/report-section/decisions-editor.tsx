'use client';

import { CheckCircle2, CircleDot } from 'lucide-react';

import { Badge } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type DecisionsEditorProps = {
  decisions: ReportSectionReadModel['decisions'];
  disabled: boolean;
};

export function DecisionsEditor({ decisions, disabled }: DecisionsEditorProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Decisions">
      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <CircleDot className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-base text-muted-foreground">No decisions pending</p>
        </div>
      ) : (
        <div className="stagger-children space-y-3">
          {decisions.map((decision) => {
            const isResolved = Boolean(decision.resolvedAt);

            return (
              <div
                key={decision.id ?? decision.text}
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  isResolved
                    ? 'border-success/20 bg-success/5'
                    : 'border-warning/20 bg-warning/5'
                }`}
              >
                {isResolved ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                )}
                <div className="flex-1">
                  <p className="text-base">{decision.text}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${
                    isResolved ? 'border-success/30 text-success' : 'border-warning/30 text-warning'
                  }`}
                >
                  {isResolved ? 'Resolved' : 'Pending'}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
