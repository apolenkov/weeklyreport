'use client';

import { Download, FileDown, Loader2 } from 'lucide-react';
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
        <Button variant="default" asChild>
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

export function PublishedReport({
  exportJob = null,
  onRequestPdfExport,
  report,
}: PublishedReportProps) {
  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-[1.2]">
            Published Report
          </h1>
          {report.publishedByName ? (
            <p className="text-sm text-muted-foreground mt-1">
              Published by {report.publishedByName}
            </p>
          ) : null}
        </div>
        <PdfExportControls
          exportJob={exportJob}
          onRequestPdfExport={onRequestPdfExport}
        />
      </div>

      {/* Portfolio overview card */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <TrafficLightBadge
            status={toTrafficLightStatus(report.portfolioOverview.status)}
            label={`Overall: ${report.portfolioOverview.status}`}
          />
        </CardContent>
      </Card>

      {/* Lead sections */}
      {report.sections.map((section, sectionIndex) => (
        <div key={section.reportSectionId}>
          {sectionIndex > 0 ? <Separator className="mb-6" /> : null}
          <Card>
            <CardHeader>
              <CardTitle>{section.authorName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Projects row */}
              {section.projects.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Projects
                  </p>
                  <div className="flex flex-wrap gap-2">
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

              {/* Items */}
              {section.items.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Items
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {section.items.map((item) => (
                      <li
                        key={item.id ?? `${section.reportSectionId}-${item.text}`}
                        className="text-sm"
                      >
                        {item.text}
                        {item.tag ? (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.tag}
                          </Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Risks */}
              {section.risks.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Risks
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {section.risks.map((risk) => (
                      <li
                        key={risk.id ?? `${section.reportSectionId}-risk-${risk.risk}`}
                        className="text-sm"
                      >
                        <span className="font-medium">{risk.risk}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          — Impact: {risk.impact}, Mitigation: {risk.mitigation}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Decisions */}
              {section.decisions.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Decisions
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {section.decisions.map((decision) => (
                      <li
                        key={decision.id ?? `${section.reportSectionId}-dec-${decision.text}`}
                        className="text-sm"
                      >
                        {decision.text}
                        <Badge
                          variant={decision.resolvedAt ? 'default' : 'outline'}
                          className="ml-2 text-xs"
                        >
                          {decision.resolvedAt ? 'Resolved' : 'Unresolved'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Priorities */}
              {section.priorities.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Priorities
                  </p>
                  <ol className="list-decimal pl-6 space-y-1">
                    {section.priorities
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((priority) => (
                        <li
                          key={priority.id ?? `${section.reportSectionId}-pri-${priority.rank}`}
                          className="text-sm"
                        >
                          {priority.text}
                        </li>
                      ))}
                  </ol>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
