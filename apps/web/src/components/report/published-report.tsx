'use client';

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CircleDot,
  Download,
  FileDown,
  Lightbulb,
  ListOrdered,
  Loader2,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  TrafficLightBadge,
} from '@customreport/ui';
import type { TrafficLightStatus } from '@customreport/ui';

import { formatPeriodDate } from '../../lib/format-date';

type PublishedReportProps = {
  readonly exportJob?: PdfExportJob | null;
  readonly onRequestPdfExport?: (() => void) | undefined;
  readonly report: AssembledReport;
};

function isTrafficLightStatus(value: string | null): value is TrafficLightStatus {
  return value === 'green' || value === 'yellow' || value === 'red';
}

function toTrafficLightStatus(value: string | null | undefined): TrafficLightStatus {
  if (value && isTrafficLightStatus(value)) return value;
  return 'unset';
}

function PdfExportControls({
  exportJob,
  onRequestPdfExport,
}: {
  readonly exportJob?: PdfExportJob | null;
  readonly onRequestPdfExport?: (() => void) | undefined;
}) {
  const isExporting =
    exportJob?.status === 'queued' || exportJob?.status === 'processing';

  function handleExportClick() {
    if (onRequestPdfExport) {
      onRequestPdfExport();
      toast('PDF export started', {
        description: 'You will be notified when ready.',
      });
    }
  }

  return (
    <div className="flex items-center gap-3">
      {exportJob?.status === 'completed' && exportJob.artifactUrl ? (
        <Button asChild>
          <a href={exportJob.artifactUrl} download>
            <Download className="size-4" />
            Download PDF
          </a>
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleExportClick}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="size-4" />
              Export PDF
            </>
          )}
        </Button>
      )}
      {exportJob ? (
        <Badge variant="outline">{exportJob.status}</Badge>
      ) : null}
    </div>
  );
}

function SectionIcon({ icon: Icon, colorClass }: { icon: React.ComponentType<{ className?: string }>; colorClass: string }) {
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorClass}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

export function PublishedReport({
  exportJob = null,
  onRequestPdfExport,
  report,
}: PublishedReportProps) {
  const periodLabel = `${formatPeriodDate(report.periodStart)} — ${formatPeriodDate(report.periodEnd)}`;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Published Report</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {periodLabel}
            </span>
            {report.publishedByName ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" />
                {report.publishedByName}
              </span>
            ) : null}
          </div>
        </div>
        <PdfExportControls
          exportJob={exportJob}
          onRequestPdfExport={onRequestPdfExport}
        />
      </div>

      {/* Portfolio overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Portfolio Overview</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <TrafficLightBadge
              status={toTrafficLightStatus(report.portfolioOverview.status)}
              label={`Overall: ${report.portfolioOverview.status}`}
              className="text-sm"
            />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-traffic-green)]" />
                <span className="font-medium">{report.portfolioOverview.totals.green}</span>
                <span className="text-muted-foreground">Green</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-traffic-yellow)]" />
                <span className="font-medium">{report.portfolioOverview.totals.yellow}</span>
                <span className="text-muted-foreground">Yellow</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-traffic-red)]" />
                <span className="font-medium">{report.portfolioOverview.totals.red}</span>
                <span className="text-muted-foreground">Red</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead sections */}
      {report.sections.map((section) => {
        const currentItems = section.items.filter((item) => item.type === 'current');
        const nextItems = section.items.filter((item) => item.type === 'next');

        return (
          <Card key={section.reportSectionId} className="overflow-hidden">
            {/* Section author header */}
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {section.authorName
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.authorName}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {section.projects.length} project{section.projects.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Badge variant={section.status === 'submitted' ? 'default' : 'outline'}>
                  {section.status === 'submitted' ? 'Submitted' : 'Draft'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Projects */}
              {section.projects.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={Target} colorClass="bg-primary/10 text-primary" />
                    <span className="text-sm font-semibold">Projects</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-9">
                    {section.projects.map((project) => (
                      <TrafficLightBadge
                        key={project.projectId}
                        status={toTrafficLightStatus(project.trafficLight)}
                        label={project.projectName}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Current Week Items */}
              {currentItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={ListOrdered} colorClass="bg-[oklch(0.68_0.17_152)]/10 text-[oklch(0.68_0.17_152)]" />
                    <span className="text-sm font-semibold">Current Week</span>
                    <Badge variant="secondary" className="text-xs">{currentItems.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {currentItems.map((item) => (
                      <div
                        key={item.id ?? `${section.reportSectionId}-current-${item.text}`}
                        className="flex items-start gap-2 rounded-md border bg-card px-3 py-2"
                      >
                        {item.carriedOver && item.completed ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className="flex-1 text-sm">{item.text}</span>
                        {item.tag ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">{item.tag}</Badge>
                        ) : null}
                        {item.carriedOver ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">Carried Over</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Next Week Items */}
              {nextItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={ListOrdered} colorClass="bg-muted text-muted-foreground" />
                    <span className="text-sm font-semibold">Next Week</span>
                    <Badge variant="secondary" className="text-xs">{nextItems.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {nextItems.map((item) => (
                      <div
                        key={item.id ?? `${section.reportSectionId}-next-${item.text}`}
                        className="flex items-start gap-2 rounded-md border bg-card px-3 py-2"
                      >
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                        <span className="flex-1 text-sm">{item.text}</span>
                        {item.tag ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">{item.tag}</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Risks */}
              {section.risks.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={AlertTriangle} colorClass="bg-destructive/10 text-destructive" />
                    <span className="text-sm font-semibold">Risks</span>
                    <Badge variant="secondary" className="text-xs">{section.risks.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {section.risks.map((risk) => (
                      <div
                        key={risk.id ?? `${section.reportSectionId}-risk-${risk.risk}`}
                        className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                      >
                        <p className="text-sm font-medium">{risk.risk}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {risk.impact ? <span>Impact: {risk.impact}</span> : null}
                          {risk.mitigation ? <span>Mitigation: {risk.mitigation}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Decisions */}
              {section.decisions.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={Lightbulb} colorClass="bg-warning/10 text-warning" />
                    <span className="text-sm font-semibold">Decisions</span>
                    <Badge variant="secondary" className="text-xs">{section.decisions.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {section.decisions.map((decision) => {
                      const isResolved = Boolean(decision.resolvedAt);
                      return (
                        <div
                          key={decision.id ?? `${section.reportSectionId}-dec-${decision.text}`}
                          className={`flex items-start gap-3 rounded-lg border p-3 ${
                            isResolved
                              ? 'border-success/20 bg-success/5'
                              : 'border-warning/20 bg-warning/5'
                          }`}
                        >
                          {isResolved ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          ) : (
                            <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm">{decision.text}</p>
                            {decision.owner ? (
                              <p className="mt-1 text-xs text-muted-foreground">Owner: {decision.owner}</p>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs ${
                              isResolved ? 'border-success/30 text-success' : 'border-warning/30 text-warning'
                            }`}
                          >
                            {isResolved ? 'Resolved' : 'Pending'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Priorities */}
              {section.priorities.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SectionIcon icon={TrendingUp} colorClass="bg-[oklch(0.62_0.18_310)]/10 text-[oklch(0.62_0.18_310)]" />
                    <span className="text-sm font-semibold">Top 3 Priorities</span>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {section.priorities
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((priority) => (
                        <div
                          key={priority.id ?? `${section.reportSectionId}-pri-${priority.rank}`}
                          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                            {priority.rank}
                          </span>
                          <span className="text-sm">{priority.text}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
