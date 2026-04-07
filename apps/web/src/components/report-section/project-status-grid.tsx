import React from 'react';

import type { ReportSectionReadModel } from '@customreport/shared';

void React;

type ProjectStatusGridProps = {
  projects: ReportSectionReadModel['projects'];
  disabled: boolean;
  onChange: (projectId: string, value: 'green' | 'yellow' | 'red' | '') => void;
};

export function ProjectStatusGrid({ projects, disabled, onChange }: ProjectStatusGridProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Project Statuses</legend>
      {projects.map((project) => (
        <label key={project.projectId}>
          <span>{project.projectName}</span>
          <select
            aria-label={`${project.projectName} traffic light`}
            value={project.trafficLight ?? ''}
            onChange={(event) => {
              onChange(
                project.projectId,
                event.currentTarget.value as 'green' | 'yellow' | 'red' | '',
              );
            }}
          >
            <option value="">Select status</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
            <option value="red">Red</option>
          </select>
        </label>
      ))}
    </fieldset>
  );
}
