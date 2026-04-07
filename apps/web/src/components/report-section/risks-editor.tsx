import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type RisksEditorProps = {
  risks: ReportSectionReadModel['risks'];
  disabled: boolean;
};

export function RisksEditor({ risks, disabled }: RisksEditorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Risks</legend>
      {risks.length === 0 ? <p>No risks added</p> : null}
    </fieldset>
  );
}
