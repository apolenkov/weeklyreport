'use client';

import { Badge, Card, CardContent } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type DecisionsEditorProps = {
  decisions: ReportSectionReadModel['decisions'];
  disabled: boolean;
};

export function DecisionsEditor({ decisions, disabled }: DecisionsEditorProps) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined} role="group" aria-label="Decisions">
      {decisions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No decisions added</p>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <Card key={decision.id ?? decision.text}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{decision.text}</p>
                  {decision.resolvedAt ? (
                    <Badge variant="outline" className="shrink-0 border-success text-success">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-destructive text-destructive">
                      Unresolved
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
