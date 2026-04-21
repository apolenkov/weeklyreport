'use client';

import { Target } from 'lucide-react';

import { Card, CardContent, cn } from '@customreport/ui';
import type { TrafficLightStatus } from '@customreport/ui';

import type { ReportSectionReadModel } from '@customreport/shared';

type ProjectStatusGridProps = {
  projects: ReportSectionReadModel['projects'];
  disabled: boolean;
  onChange: (projectId: string, value: 'green' | 'yellow' | 'red' | '') => void;
};

const statuses: Array<{ value: TrafficLightStatus; raw: 'green' | 'yellow' | 'red' | ''; label: string }> = [
  { value: 'green', raw: 'green', label: 'On Track' },
  { value: 'yellow', raw: 'yellow', label: 'At Risk' },
  { value: 'red', raw: 'red', label: 'Blocked' },
  { value: 'unset', raw: '', label: 'Clear' },
];

const selectedBorderMap: Record<TrafficLightStatus, string> = {
  green: 'border-[var(--color-traffic-green-border)] bg-[var(--color-traffic-green)]/5',
  yellow: 'border-[var(--color-traffic-yellow-border)] bg-[var(--color-traffic-yellow)]/5',
  red: 'border-[var(--color-traffic-red-border)] bg-[var(--color-traffic-red)]/5',
  unset: '',
};

const dotColorMap: Record<TrafficLightStatus, string> = {
  green: 'bg-[var(--color-traffic-green-foreground)]',
  yellow: 'bg-[var(--color-traffic-yellow-foreground)]',
  red: 'bg-[var(--color-traffic-red-foreground)]',
  unset: 'bg-muted-foreground/30',
};

const hoverMap: Record<TrafficLightStatus, string> = {
  green: 'hover:bg-[var(--color-traffic-green)]/10 hover:border-[var(--color-traffic-green-border)]/50',
  yellow: 'hover:bg-[var(--color-traffic-yellow)]/10 hover:border-[var(--color-traffic-yellow-border)]/50',
  red: 'hover:bg-[var(--color-traffic-red)]/10 hover:border-[var(--color-traffic-red-border)]/50',
  unset: 'hover:bg-muted/50 hover:border-muted-foreground/20',
};

const selectedMap: Record<TrafficLightStatus, string> = {
  green: 'bg-[var(--color-traffic-green)]/15 border-[var(--color-traffic-green-border)] shadow-sm shadow-[var(--color-traffic-green)]/10',
  yellow: 'bg-[var(--color-traffic-yellow)]/15 border-[var(--color-traffic-yellow-border)] shadow-sm shadow-[var(--color-traffic-yellow)]/10',
  red: 'bg-[var(--color-traffic-red)]/15 border-[var(--color-traffic-red-border)] shadow-sm shadow-[var(--color-traffic-red)]/10',
  unset: 'bg-muted/30 border-muted-foreground/30',
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
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{project.projectName}</span>
                {currentStatus !== 'unset' ? (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    currentStatus === 'green' && 'bg-[var(--color-traffic-green)]/15 text-[var(--color-traffic-green-foreground)]',
                    currentStatus === 'yellow' && 'bg-[var(--color-traffic-yellow)]/15 text-[var(--color-traffic-yellow-foreground)]',
                    currentStatus === 'red' && 'bg-[var(--color-traffic-red)]/15 text-[var(--color-traffic-red-foreground)]',
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', dotColorMap[currentStatus])} />
                    {statuses.find((s) => s.value === currentStatus)?.label}
                  </span>
                ) : null}
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={`${project.projectName} traffic light`}
              >
                {statuses.map((s) => {
                  const isSelected = currentStatus === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-label={`Set ${project.projectName} to ${s.value === 'unset' ? 'no status' : s.label}`}
                      aria-checked={isSelected}
                      role="radio"
                      className={cn(
                        'group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected
                          ? selectedMap[s.value]
                          : cn('border-border/50 bg-transparent', hoverMap[s.value]),
                      )}
                      onClick={() => onChange(project.projectId, s.raw)}
                      disabled={disabled}
                    >
                      <span className={cn(
                        'inline-block h-3 w-3 rounded-full transition-transform duration-150',
                        dotColorMap[s.value],
                        isSelected ? 'scale-110' : 'scale-100 opacity-60 group-hover:opacity-100',
                      )} />
                      <span className={cn(
                        'transition-colors',
                        isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                      )}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
