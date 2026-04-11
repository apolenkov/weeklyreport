'use client';

import { Badge, Card, CardContent } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type RisksEditorProps = {
  risks: ReportSectionReadModel['risks'];
  disabled: boolean;
};

export function RisksEditor({ risks, disabled }: RisksEditorProps) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined} role="group" aria-label="Risks">
      {risks.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No risks added</p>
      ) : (
        <div className="space-y-3">
          {risks.map((risk) => (
            <Card key={risk.id ?? risk.risk}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{risk.risk}</p>
                  {risk.impact ? (
                    <Badge variant="outline" className="shrink-0">{risk.impact}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
