'use client';

import { useParams } from 'next/navigation';

import type { TrafficLightStatus } from '@customreport/ui';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  TrafficLightBadge,
} from '@customreport/ui';

import { trpc } from '../../../../../lib/trpc';

function isTrafficLightStatus(
  value: string | null,
): value is TrafficLightStatus {
  return value === 'green' || value === 'yellow' || value === 'red';
}

function toTrafficLightStatus(
  value: string | null | undefined,
): TrafficLightStatus {
  if (value && isTrafficLightStatus(value)) return value;
  return 'unset';
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PrintReportPage() {
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId ?? '';

  const reportQuery = trpc.archive.detail.useQuery(
    { reportId },
    { enabled: Boolean(reportId) },
  );

  if (reportQuery.isLoading) return <p>Loading report for print...</p>;
  if (reportQuery.error) return <p>Error loading report.</p>;

  const detail = reportQuery.data;

  if (!detail) return <p>Report not found.</p>;

  const { report } = detail;

  return (
    <main className="max-w-[1100px] mx-auto p-8 print:p-0 print:bg-white">
      {/* Report header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold leading-[1.2]">
          Weekly Status Report
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          {formatDate(report.periodStart)} &mdash;{' '}
          {formatDate(report.periodEnd)}
        </p>
        {report.publishedAt ? (
          <p className="text-sm text-muted-foreground mt-1">
            Published {formatDate(report.publishedAt)}
            {report.publishedByName
              ? ` by ${report.publishedByName}`
              : null}
          </p>
        ) : null}
      </div>

      <Separator className="mb-6" />

      {/* Portfolio overview card */}
      <Card className="mb-6 print:shadow-none print:border">
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
        <Card
          key={section.reportSectionId}
          className={`mb-6 break-inside-avoid print:shadow-none print:border ${
            sectionIndex > 0 ? 'break-before-page' : ''
          }`}
        >
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
                      key={
                        item.id ??
                        `${section.reportSectionId}-${item.text}`
                      }
                      className="text-sm"
                    >
                      {item.text}
                      {item.tag ? (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs"
                        >
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
                      key={
                        risk.id ??
                        `${section.reportSectionId}-risk-${risk.risk}`
                      }
                      className="text-sm"
                    >
                      <span className="font-medium">{risk.risk}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        &mdash; Impact: {risk.impact}, Mitigation:{' '}
                        {risk.mitigation}
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
                      key={
                        decision.id ??
                        `${section.reportSectionId}-dec-${decision.text}`
                      }
                      className="text-sm"
                    >
                      {decision.text}
                      <Badge
                        variant={
                          decision.resolvedAt ? 'default' : 'outline'
                        }
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
                        key={
                          priority.id ??
                          `${section.reportSectionId}-pri-${priority.rank}`
                        }
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
      ))}
    </main>
  );
}
