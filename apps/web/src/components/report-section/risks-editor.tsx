'use client';

import { AlertTriangle } from 'lucide-react';

import { Badge } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type RisksEditorProps = {
  risks: ReportSectionReadModel['risks'];
  disabled: boolean;
};

export function RisksEditor({ risks, disabled }: RisksEditorProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} role="group" aria-label="Risks">
      {risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-base text-muted-foreground">No active risks</p>
        </div>
      ) : (
        <div className="stagger-children space-y-3">
          {risks.map((risk) => (
            <div
              key={risk.id ?? risk.risk}
              className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-base">{risk.risk}</p>
              </div>
              {risk.impact ? (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {risk.impact}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
