'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  type AssembledReport,
  type DraftSavePayload,
  type ReportSectionReadModel,
} from '@customreport/shared';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Label,
  Separator,
  TrafficLightBadge,
  type TrafficLightStatus,
} from '@customreport/ui';

type AssembledReportReviewProps = {
  initialReport: AssembledReport;
  onUpdateSection: (input: DraftSavePayload) => Promise<AssembledReport>;
  onPublish: () => Promise<AssembledReport>;
};

function toDraftSavePayload(section: ReportSectionReadModel): DraftSavePayload {
  return {
    reportSectionId: section.reportSectionId,
    status: section.status,
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight ?? undefined,
    })),
    items: section.items,
    risks: section.risks,
    decisions: section.decisions,
    priorities: section.priorities,
  };
}

function toTrafficLightStatus(
  value: string | null | undefined,
): TrafficLightStatus {
  if (value === 'green' || value === 'yellow' || value === 'red') {
    return value;
  }
  return 'unset';
}

const trafficLightOptions: { value: TrafficLightStatus; label: string }[] = [
  { value: 'unset', label: 'No Status' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
];

export function AssembledReportReview({
  initialReport,
  onPublish,
  onUpdateSection,
}: AssembledReportReviewProps) {
  const [report, setReport] = useState(initialReport);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const isPublished = report.status === 'published';

  async function handleTrafficLightChange(
    section: ReportSectionReadModel,
    projectId: string,
    trafficLight: TrafficLightStatus,
  ) {
    const nextSection: ReportSectionReadModel = {
      ...section,
      projects: section.projects.map((project) =>
        project.projectId === projectId
          ? {
              ...project,
              trafficLight: trafficLight === 'unset' ? null : trafficLight,
            }
          : project,
      ),
    };

    setReport(await onUpdateSection(toDraftSavePayload(nextSection)));
  }

  async function handleFirstItemChange(
    section: ReportSectionReadModel,
    text: string,
  ) {
    if (!section.items || section.items.length === 0) {
      return;
    }

    const nextSection: ReportSectionReadModel = {
      ...section,
      items: section.items.map((item, index) =>
        index === 0 ? { ...item, text } : item,
      ),
    };

    setReport(await onUpdateSection(toDraftSavePayload(nextSection)));
  }

  async function handlePublish() {
    setPublishLoading(true);
    try {
      const result = await onPublish();
      setReport(result);
      setPublishDialogOpen(false);
      toast.success('Report published', {
        description: 'The report is now visible to viewers.',
      });
    } finally {
      setPublishLoading(false);
    }
  }

  return (
    <div className="animate-fade-in stagger-children space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          Assembled Report
        </h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{report.portfolioOverview.status}</Badge>
          {isPublished ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              Published
            </Badge>
          ) : null}
        </div>
      </div>

      {report.sections.map((section, sectionIndex) => {
        const firstProject = section.projects[0];
        const firstItem = section.items[0];

        return (
          <div key={section.reportSectionId}>
            {sectionIndex > 0 ? <Separator className="mb-6" /> : null}
            <Card>
              <CardHeader>
                <CardTitle className="text-[20px] font-semibold leading-[1.3]">
                  {section.authorName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {firstProject ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      {firstProject.projectName} status
                    </Label>
                    <div
                      className="flex items-center gap-2"
                      role="radiogroup"
                      aria-label={`${section.authorName} / ${firstProject.projectName} traffic light`}
                    >
                      {trafficLightOptions.map((option) => {
                        const currentStatus = toTrafficLightStatus(
                          firstProject.trafficLight,
                        );
                        const isActive = currentStatus === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            aria-label={option.label}
                            disabled={isPublished}
                            className={`rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              isActive
                                ? 'ring-2 ring-ring ring-offset-2'
                                : 'opacity-60 hover:opacity-100'
                            } ${isPublished ? 'pointer-events-none cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                            onClick={() =>
                              void handleTrafficLightChange(
                                section,
                                firstProject.projectId,
                                option.value,
                              )
                            }
                          >
                            <TrafficLightBadge status={option.value} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {firstItem ? (
                  <div className="space-y-3">
                    <Label htmlFor={`item-${section.reportSectionId}`}>
                      First item
                    </Label>
                    <Input
                      id={`item-${section.reportSectionId}`}
                      aria-label={`${section.authorName} first item`}
                      disabled={isPublished}
                      value={firstItem.text}
                      onChange={(event) =>
                        void handleFirstItemChange(
                          section,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {!isPublished ? (
        <div className="flex justify-end">
          <Button onClick={() => setPublishDialogOpen(true)}>
            Publish Report
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        title="Publish Report"
        description="This will make the report visible to all viewers. Published reports cannot be edited. Continue?"
        confirmLabel="Publish"
        variant="default"
        loading={publishLoading}
        onConfirm={() => void handlePublish()}
      />
    </div>
  );
}
