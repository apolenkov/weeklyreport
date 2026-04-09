'use client';

import React from 'react';
import { useState } from 'react';

import {
  type AssembledReport,
  type DraftSavePayload,
  type ReportSectionReadModel,
} from '@customreport/shared';

void React;

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

export function AssembledReportReview({
  initialReport,
  onPublish,
  onUpdateSection,
}: AssembledReportReviewProps) {
  const [report, setReport] = useState(initialReport);
  const isPublished = report.status === 'published';

  async function handleTrafficLightChange(
    section: ReportSectionReadModel,
    projectId: string,
    trafficLight: 'green' | 'yellow' | 'red' | '',
  ) {
    const nextSection: ReportSectionReadModel = {
      ...section,
      projects: section.projects.map((project) =>
        project.projectId === projectId
          ? { ...project, trafficLight: trafficLight || null }
          : project,
      ),
    };

    setReport(await onUpdateSection(toDraftSavePayload(nextSection)));
  }

  async function handleFirstItemChange(
    section: ReportSectionReadModel,
    text: string,
  ) {
    const nextSection: ReportSectionReadModel = {
      ...section,
      items: section.items.map((item, index) =>
        index === 0 ? { ...item, text } : item,
      ),
    };

    setReport(await onUpdateSection(toDraftSavePayload(nextSection)));
  }

  async function handlePublish() {
    setReport(await onPublish());
  }

  return (
    <section>
      <h1>Assembled Report</h1>
      <p>Portfolio status: {report.portfolioOverview.status}</p>
      {isPublished ? <p>Report published</p> : null}
      {report.sections.map((section) => {
        const firstProject = section.projects[0];
        const firstItem = section.items[0];

        return (
          <article key={section.reportSectionId}>
            <h2>{section.authorName}</h2>
            {firstProject ? (
              <label>
                {`${section.authorName} / ${firstProject.projectName} traffic light`}
                <select
                  aria-label={`${section.authorName} / ${firstProject.projectName} traffic light`}
                  disabled={isPublished}
                  onChange={(event) =>
                    void handleTrafficLightChange(
                      section,
                      firstProject.projectId,
                      event.currentTarget.value as 'green' | 'yellow' | 'red' | '',
                    )
                  }
                  value={firstProject.trafficLight ?? ''}
                >
                  <option value="">Unset</option>
                  <option value="green">green</option>
                  <option value="yellow">yellow</option>
                  <option value="red">red</option>
                </select>
              </label>
            ) : null}
            {firstItem ? (
              <label>
                {`${section.authorName} first item`}
                <input
                  aria-label={`${section.authorName} first item`}
                  disabled={isPublished}
                  onChange={(event) =>
                    void handleFirstItemChange(section, event.currentTarget.value)
                  }
                  value={firstItem.text}
                />
              </label>
            ) : null}
          </article>
        );
      })}
      {!isPublished ? (
        <button onClick={() => void handlePublish()} type="button">
          Publish report
        </button>
      ) : null}
    </section>
  );
}
