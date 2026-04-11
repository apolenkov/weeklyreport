'use client';

import { Card, CardContent, CardTitle, TrafficLightBadge, cn } from '@customreport/ui';
import type { TrafficLightStatus } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type ProjectStatusGridProps = {
  projects: ReportSectionReadModel['projects'];
  disabled: boolean;
  onChange: (projectId: string, value: 'green' | 'yellow' | 'red' | '') => void;
};

const statuses: Array<{ value: TrafficLightStatus; raw: 'green' | 'yellow' | 'red' | '' }> = [
  { value: 'green', raw: 'green' },
  { value: 'yellow', raw: 'yellow' },
  { value: 'red', raw: 'red' },
  { value: 'unset', raw: '' },
];

export function ProjectStatusGrid({ projects, disabled, onChange }: ProjectStatusGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-4',
        disabled && 'opacity-50 pointer-events-none',
      )}
      role="group"
      aria-label="Project Statuses"
    >
      {projects.map((project) => {
        const currentStatus: TrafficLightStatus =
          (project.trafficLight as TrafficLightStatus | null) ?? 'unset';

        return (
          <Card key={project.projectId}>
            <CardContent className="pt-4 pb-4">
              <CardTitle className="text-sm font-semibold mb-3">
                {project.projectName}
              </CardTitle>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${project.projectName} traffic light`}>
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-label={`Set ${project.projectName} to ${s.value === 'unset' ? 'no status' : s.value}`}
                    aria-checked={currentStatus === s.value}
                    role="radio"
                    className={cn(
                      'rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      currentStatus === s.value && 'ring-2 ring-ring',
                    )}
                    onClick={() => onChange(project.projectId, s.raw)}
                    disabled={disabled}
                  >
                    <TrafficLightBadge status={s.value} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
