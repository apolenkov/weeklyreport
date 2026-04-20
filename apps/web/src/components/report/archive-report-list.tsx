'use client';

import { ArrowRight, BookOpen, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';

import type { ArchiveReportSummary } from '@customreport/shared';
import {
  TrafficLightBadge,
} from '@customreport/ui';
import type { TrafficLightStatus } from '@customreport/ui';

import { formatDate, formatPeriodDate } from '../../lib/format-date';
import { EmptyState } from '../common/empty-state';

type ArchiveReportListProps = {
  readonly reports: ArchiveReportSummary[];
};

function toTrafficLightStatus(value: string): TrafficLightStatus {
  if (value === 'green' || value === 'yellow' || value === 'red') return value;
  return 'unset';
}

export function ArchiveReportList({ reports }: ArchiveReportListProps) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Опубликованных отчётов нет"
        description="Отчёты ещё не публиковались. Опубликованные отчёты появятся в этом списке."
      />
    );
  }

  return (
    <div className="stagger-children space-y-4">
      {reports.map((report) => (
        <Link
          key={report.reportId}
          href={`/reports/${report.reportId}`}
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">
                {formatPeriodDate(report.periodStart)} — {formatPeriodDate(report.periodEnd)}
              </span>
              <TrafficLightBadge status={toTrafficLightStatus(report.portfolioStatus)} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              Published {formatDate(report.publishedAt)}
              <span>· by {report.publishedByName}</span>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-1 group-hover:text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
