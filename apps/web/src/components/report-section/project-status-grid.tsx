'use client';

import { Target } from 'lucide-react';

import { Card, CardContent, TrafficLightBadge, cn } from '@customreport/ui';
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

const selectedBorderMap: Record<TrafficLightStatus, string> = {
  green: 'border-[var(--color-traffic-green-border)] bg-[var(--color-traffic-green)]/5',
  yellow: 'border-[var(--color-traffic-yellow-border)] bg-[var(--color-traffic-yellow)]/5',
  red: 'border-[var(--color-traffic-red-border)] bg-[var(--color-traffic-red)]/5',
  unset: '',
};

export function ProjectStatusGrid({ projects, disabled, onChange }: ProjectStatusGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-base text-muted-foreground">No projects assigned</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'stagger-children grid grid-cols-1 gap-4 md:grid-cols-2',
        disabled && 'pointer-events-none opacity-50',
      )}
      role="group"
      aria-label="Project Statuses"
    >
      {projects.map((project) => {
        const currentStatus: TrafficLightStatus =
          (project.trafficLight as TrafficLightStatus | null) ?? 'unset';

        return (
          <Card
            key={project.projectId}
            className={cn(
              'transition-all duration-200',
              currentStatus !== 'unset' && selectedBorderMap[currentStatus],
            )}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{project.projectName}</span>
                <TrafficLightBadge status={currentStatus} />
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={`${project.projectName} traffic light`}
              >
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-label={`Set ${project.projectName} to ${s.value === 'unset' ? 'no status' : s.value}`}
                    aria-checked={currentStatus === s.value}
                    role="radio"
                    className={cn(
                      'rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      'border',
                      currentStatus === s.value
                        ? 'ring-2 ring-ring ring-offset-1 shadow-sm'
                        : 'border-border hover:border-foreground/20 hover:bg-accent',
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
