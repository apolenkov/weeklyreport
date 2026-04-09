import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type DecisionsEditorProps = {
  decisions: ReportSectionReadModel['decisions'];
  disabled: boolean;
};

export function DecisionsEditor({ decisions, disabled }: DecisionsEditorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Decisions</legend>
      {decisions.length === 0 ? <p>No decisions added</p> : null}
      {decisions.map((decision) => (
        <article key={decision.id ?? decision.text}>
          <p>{decision.text}</p>
          {decision.resolvedAt ? null : <p>Unresolved decision</p>}
        </article>
      ))}
    </fieldset>
  );
}
