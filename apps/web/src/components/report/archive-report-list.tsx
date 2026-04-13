'use client';

import { ArrowRight, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';

import type { ArchiveReportSummary } from '@customreport/shared';
import {
  Button,
  TrafficLightBadge,
} from '@customreport/ui';
import type { TrafficLightStatus } from '@customreport/ui';

import { formatDate, formatPeriodDate } from '../../lib/format-date';

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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No published reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Link
          key={report.reportId}
          href={`/reports/${report.reportId}`}
          className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {formatPeriodDate(report.periodStart)} — {formatPeriodDate(report.periodEnd)}
              </span>
              <TrafficLightBadge status={toTrafficLightStatus(report.portfolioStatus)} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              Published {formatDate(report.publishedAt)}
              <span className="text-muted-foreground/60">by {report.publishedByName}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            tabIndex={-1}
            aria-hidden
            asChild
          >
            <span>
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </Link>
      ))}
    </div>
  );
}
