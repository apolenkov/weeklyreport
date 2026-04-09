import React from 'react';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';

void React;

type PublishedReportProps = {
  exportJob?: PdfExportJob | null;
  onRequestPdfExport?: (() => void) | undefined;
  report: AssembledReport;
};

export function PublishedReport({ exportJob = null, onRequestPdfExport, report }: PublishedReportProps) {
  return (
    <section>
      <h1>Published Report</h1>
      {report.publishedByName ? <p>{`Published by ${report.publishedByName}`}</p> : null}
      <p>Portfolio status: {report.portfolioOverview.status}</p>
      <button onClick={onRequestPdfExport} type="button">
        Export PDF
      </button>
      {exportJob ? <p>{`Export status: ${exportJob.status}`}</p> : null}
      {exportJob?.artifactUrl ? <a href={exportJob.artifactUrl}>Download PDF</a> : null}
      {report.sections.map((section) => (
        <article key={section.reportSectionId}>
          <h2>{section.authorName}</h2>
          {section.projects.map((project) => (
            <p key={project.projectId}>{`${project.projectName}: ${project.trafficLight ?? 'unset'}`}</p>
          ))}
          {section.items.map((item, index) => (
            <p key={`${section.reportSectionId}-${index}`}>{item.text}</p>
          ))}
        </article>
      ))}
    </section>
  );
}
