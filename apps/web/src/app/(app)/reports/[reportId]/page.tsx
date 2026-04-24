import {
  MOCK_KPI,
  MOCK_PORTFOLIO,
  MOCK_PRODUCT_REPORTS,
  type ProductReport,
  type PortfolioProduct,
} from '../../../../components/dashboard/mock-data';

/* ------------------------------------------------------------------ */
/*  Published Report Viewer — Server Component                        */
/*  Web version of the published report with navigation and actions.  */
/* ------------------------------------------------------------------ */

type Props = {
  params: Promise<{ reportId: string }>;
};

function statusColor(status: string): string {
  switch (status) {
    case 'on-track':
      return 'var(--color-starbucks-green, #006241)';
    case 'at-risk':
      return '#daa520';
    case 'blocked':
      return '#c82014';
    default:
      return 'var(--color-muted-foreground, #6b7280)';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'on-track':
      return 'On Track';
    case 'at-risk':
      return 'At Risk';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
}

function workflowBadgeClasses(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-[var(--color-green-light,#d4e9e2)] text-[var(--color-starbucks-green,#006241)]';
    case 'in-progress':
      return 'bg-[var(--color-muted,#f0f0f0)] text-[var(--color-muted-foreground,#6b7280)]';
    case 'blocked':
      return 'bg-red-100 text-[#c82014]';
    case 'planned':
      return 'bg-[var(--color-muted,#f0f0f0)] text-[var(--color-muted-foreground,#6b7280)]';
    default:
      return 'bg-[var(--color-muted,#f0f0f0)] text-[var(--color-muted-foreground,#6b7280)]';
  }
}

function workflowBadge(status: string): string {
  switch (status) {
    case 'completed':
      return 'Done';
    case 'in-progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    case 'planned':
      return 'Planned';
    default:
      return status;
  }
}

/* ---- Portfolio Overview Table ---- */

function PortfolioTable({
  products,
}: {
  products: PortfolioProduct[];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius,12px)] border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-house-green,#1E3932)] text-white">
            <th className="px-4 py-3 text-left font-semibold">Product</th>
            <th className="px-4 py-3 text-center font-semibold">Status</th>
            <th className="px-4 py-3 text-left font-semibold">Leads</th>
            <th className="w-20 px-4 py-3 text-center font-semibold">This Week</th>
            <th className="w-20 px-4 py-3 text-center font-semibold">Next Week</th>
            <th className="w-16 px-4 py-3 text-center font-semibold">Risks</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              <td className="px-4 py-3 font-semibold">{p.name}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className="inline-block rounded-[var(--radius-pill,50px)] px-3 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor(p.status) }}
                >
                  {statusLabel(p.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{p.leads}</td>
              <td className="px-4 py-3 text-center">{p.currentWeekCount}</td>
              <td className="px-4 py-3 text-center">{p.nextWeekCount}</td>
              <td className="px-4 py-3 text-center">
                {p.riskCount > 0 ? (
                  <span className="font-semibold text-[#c82014]">{p.riskCount}</span>
                ) : (
                  <span className="text-[var(--color-muted-foreground)]">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Product Report Section ---- */

function ProductSection({
  report,
}: {
  report: ProductReport;
}) {
  return (
    <section className="rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: '#1E3932' }}
        >
          {report.initials}
        </span>
        <h3 className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-starbucks-green,#006241)]">
          {report.name}
        </h3>
        <span
          className="inline-block rounded-[var(--radius-pill,50px)] px-3 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: statusColor(report.status) }}
        >
          {statusLabel(report.status)}
        </span>
        <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">{report.leads}</span>
      </div>

      {/* Needs Attention */}
      {report.needsAttention && (
        <div
          className="mb-4 rounded-lg border-l-4 bg-amber-50 p-3 text-sm"
          style={{ borderLeftColor: statusColor(report.needsAttentionSeverity ?? 'at-risk') }}
        >
          {report.needsAttention}
        </div>
      )}

      <div className="space-y-4">
        {/* Current Week */}
        {report.currentWeek.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(0,0,0,0.58)]">
              Current Week
            </h4>
            <ul className="space-y-1.5 text-sm">
              {report.currentWeek.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                    [{item.stageLead}]
                  </span>
                  <span className="flex-1">{item.text}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${workflowBadgeClasses(item.status)}`}
                  >
                    {workflowBadge(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Week */}
        {report.nextWeek.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(0,0,0,0.58)]">
              Next Week
            </h4>
            <ul className="space-y-1 text-sm">
              {report.nextWeek.map((item) => (
                <li key={item.id} className="text-[var(--color-muted-foreground)]">
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {report.risks.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c82014]">
              Risks & Blockers
            </h4>
            <ul className="space-y-1.5 text-sm">
              {report.risks.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      r.severity === 'blocked'
                        ? 'bg-red-100 text-[#c82014]'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.badge}
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Decisions */}
        {report.decisions.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(0,0,0,0.87)]">
              Decisions Needed
            </h4>
            <ul className="space-y-1.5 text-sm">
              {report.decisions.map((d) => (
                <li key={d.id} className="flex items-start gap-2">
                  <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                    {d.badge}
                  </span>
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Priorities */}
        {report.priorities.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(0,0,0,0.87)]">
              Priorities
            </h4>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {report.priorities.map((p) => (
                <li key={p.rank}>{p.text}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---- Main Published Report Page ---- */

export default async function PublishedReportPage({ params }: Props) {
  const { reportId } = await params;

  const submissionSummary = `${MOCK_KPI.submitted}/${MOCK_KPI.total} leads submitted`;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top actions bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Weekly Status Report
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Week 16 &middot; Apr 14–20, 2026 &middot; {submissionSummary}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/head/dashboard"
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              style={{ minHeight: '44px' }}
              aria-label="Back to Dashboard"
            >
              Back to Dashboard
            </a>
            <a
              href={`/reports/${reportId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-green-accent,#00754A)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-green,#006241)]"
              style={{ minHeight: '44px' }}
              aria-label="Export PDF"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF
            </a>
          </div>
        </div>

        {/* Published metadata */}
        <div className="mb-6 rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-green,#006241)] px-3 py-1 text-xs font-semibold text-white">
              Published
            </span>
            <span className="text-[var(--color-muted-foreground)]">
              Published by Department Head on Apr 20, 2026 at 18:30
            </span>
          </div>
        </div>

        {/* Executive Summary KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center shadow-sm">
            <div className="text-2xl font-semibold text-[var(--color-starbucks-green,#006241)]">
              {MOCK_KPI.submitted}/{MOCK_KPI.total}
            </div>
            <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">Submitted</div>
          </div>
          <div className="rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center shadow-sm">
            <div className="text-2xl font-semibold text-[#c82014]">
              {MOCK_KPI.blockedCount}
            </div>
            <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">Blocked</div>
          </div>
          <div className="rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center shadow-sm">
            <div className="text-2xl font-semibold text-[#daa520]">
              {MOCK_KPI.atRiskCount}
            </div>
            <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">At Risk</div>
          </div>
          <div className="rounded-[var(--radius,12px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center shadow-sm">
            <div className="text-2xl font-semibold text-indigo-700">
              {MOCK_KPI.decisionCount}
            </div>
            <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">Decisions</div>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="mb-6">
          <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-starbucks-green,#006241)]">
            Portfolio Overview
          </h2>
          <PortfolioTable products={MOCK_PORTFOLIO} />
        </div>

        {/* Product Report Sections */}
        <div>
          <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-starbucks-green,#006241)]">
            Product Reports
          </h2>
          <div className="space-y-4">
            {MOCK_PRODUCT_REPORTS.map((report) => (
              <ProductSection key={report.id} report={report} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
