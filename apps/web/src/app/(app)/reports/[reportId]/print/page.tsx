'use client';

import { useParams } from 'next/navigation';

import { trpc } from '../../../../../lib/trpc';

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
    <main>
      <h1>
        Report: {String(report.periodStart)} — {String(report.periodEnd)}
      </h1>
      <p>Status: {report.status} | Published: {String(report.publishedAt)}</p>

      {report.sections.map((section) => (
        <section key={section.reportSectionId}>
          <h2>{section.authorName}</h2>

          <h3>Projects</h3>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Traffic Light</th>
              </tr>
            </thead>
            <tbody>
              {section.projects.map((project) => (
                <tr key={project.projectId}>
                  <td>{project.projectName}</td>
                  <td>{project.trafficLight ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {section.items.length > 0 ? (
            <>
              <h3>Items</h3>
              <ul>
                {section.items.map((item, idx) => (
                  <li key={idx}>
                    [{item.type}] {item.text} ({item.tag})
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {section.risks.length > 0 ? (
            <>
              <h3>Risks</h3>
              <ul>
                {section.risks.map((risk, idx) => (
                  <li key={idx}>
                    {risk.risk} — Impact: {risk.impact}, Mitigation: {risk.mitigation}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {section.decisions.length > 0 ? (
            <>
              <h3>Decisions Needed</h3>
              <ul>
                {section.decisions.map((decision, idx) => (
                  <li key={idx}>
                    {decision.text} — Owner: {decision.owner}, Impact: {decision.impact}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {section.priorities.length > 0 ? (
            <>
              <h3>Priorities</h3>
              <ol>
                {section.priorities.map((priority, idx) => (
                  <li key={idx}>{priority.text}</li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      ))}
    </main>
  );
}
