"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { mapWeeklyReport } from "../../../lib/mappers";
import type {
  PortfolioProduct,
  ProductReport,
} from "../../../components/dashboard/mock-data";

/* ------------------------------------------------------------------ */
/*  Print/PDF Template — Client Component (Phase 21)                  */
/*  Renders an A4-optimized weekly status report. Fetches via tRPC by */
/*  reportId param. Phase 23 owns server-rendered PDF orchestration;  */
/*  this page remains the visual template until then.                 */
/* ------------------------------------------------------------------ */

type Props = {
  params: Promise<{ reportId: string }>;
};

function statusColor(status: string): string {
  switch (status) {
    case "on-track":
      return "#006241";
    case "at-risk":
      return "#daa520";
    case "blocked":
      return "#c82014";
    default:
      return "#6b7280";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "on-track":
      return "On Track";
    case "at-risk":
      return "At Risk";
    case "blocked":
      return "Blocked";
    default:
      return status;
  }
}

function workflowBadge(status: string): string {
  switch (status) {
    case "completed":
      return "Done";
    case "in-progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "planned":
      return "Planned";
    default:
      return status;
  }
}

/* ---- Portfolio Overview Table ---- */

function PortfolioTable({ products }: { products: PortfolioProduct[] }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "11px",
        lineHeight: "1.4",
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: "#1E3932",
            color: "#ffffff",
          }}
        >
          <th style={{ padding: "6px 8px", textAlign: "left" }}>Product</th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "80px" }}
          >
            Status
          </th>
          <th style={{ padding: "6px 8px", textAlign: "left" }}>Leads</th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "60px" }}
          >
            This Week
          </th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "60px" }}
          >
            Next Week
          </th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "50px" }}
          >
            Risks
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr
            key={p.id}
            style={{
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <td style={{ padding: "5px 8px", fontWeight: 600 }}>{p.name}</td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "50px",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: statusColor(p.status),
                }}
              >
                {statusLabel(p.status)}
              </span>
            </td>
            <td style={{ padding: "5px 8px", color: "rgba(0,0,0,0.58)" }}>
              {p.leads}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {p.currentWeekCount}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {p.nextWeekCount}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {p.riskCount > 0 ? (
                <span style={{ color: "#c82014", fontWeight: 600 }}>
                  {p.riskCount}
                </span>
              ) : (
                <span style={{ color: "rgba(0,0,0,0.38)" }}>0</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- Lead Section (flat, no accordion) ---- */

function LeadSection({ report }: { report: ProductReport }) {
  return (
    <section
      style={{
        marginBottom: "16px",
        pageBreakInside: "avoid",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
          paddingBottom: "4px",
          borderBottom: "2px solid #006241",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            backgroundColor: "#1E3932",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {report.initials}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "#006241",
          }}
        >
          {report.name}
        </h3>
        <span
          style={{
            display: "inline-block",
            padding: "1px 8px",
            borderRadius: "50px",
            fontSize: "10px",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: statusColor(report.status),
          }}
        >
          {statusLabel(report.status)}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "rgba(0,0,0,0.58)",
            marginLeft: "auto",
          }}
        >
          {report.leads}
        </span>
      </div>

      {/* Needs Attention */}
      {report.needsAttention && (
        <div
          style={{
            padding: "6px 10px",
            marginBottom: "8px",
            borderLeft: `3px solid ${statusColor(report.needsAttentionSeverity ?? "at-risk")}`,
            backgroundColor: "#fef9e7",
            fontSize: "11px",
          }}
        >
          {report.needsAttention}
        </div>
      )}

      {/* Current Week */}
      {report.currentWeek.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(0,0,0,0.87)",
            }}
          >
            Current Week
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {report.currentWeek.map((item) => (
              <li key={item.id}>
                <span style={{ color: "rgba(0,0,0,0.58)", fontSize: "10px" }}>
                  [{item.stageLead}]
                </span>{" "}
                {item.text}{" "}
                <span
                  style={{
                    fontSize: "9px",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    backgroundColor:
                      item.status === "completed"
                        ? "#d4e9e2"
                        : item.status === "blocked"
                          ? "#fde8e8"
                          : "#f0f0f0",
                    color:
                      item.status === "completed"
                        ? "#006241"
                        : item.status === "blocked"
                          ? "#c82014"
                          : "rgba(0,0,0,0.58)",
                  }}
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
        <div style={{ marginBottom: "6px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(0,0,0,0.87)",
            }}
          >
            Next Week
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {report.nextWeek.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {report.risks.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#c82014",
            }}
          >
            Risks & Blockers
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {report.risks.map((r) => (
              <li key={r.id}>
                <span
                  style={{
                    fontSize: "9px",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    backgroundColor:
                      r.severity === "blocked" ? "#fde8e8" : "#fef9e7",
                    color: r.severity === "blocked" ? "#c82014" : "#b45309",
                    fontWeight: 600,
                  }}
                >
                  {r.badge}
                </span>{" "}
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {report.decisions.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(0,0,0,0.87)",
            }}
          >
            Decisions Needed
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {report.decisions.map((d) => (
              <li key={d.id}>
                <span
                  style={{
                    fontSize: "9px",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    backgroundColor: "#e0e7ff",
                    color: "#3730a3",
                    fontWeight: 600,
                  }}
                >
                  {d.badge}
                </span>{" "}
                {d.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Priorities */}
      {report.priorities.length > 0 && (
        <div style={{ marginBottom: "6px" }}>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(0,0,0,0.87)",
            }}
          >
            Priorities
          </h4>
          <ol
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {report.priorities.map((p) => (
              <li key={p.rank} value={p.rank}>
                {p.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function LoadingShell({ reportId }: { reportId: string }) {
  return (
    <main
      style={{
        backgroundColor: "#ffffff",
        color: "rgba(0,0,0,0.87)",
        fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: "12px",
        maxWidth: "210mm",
        margin: "0 auto",
        padding: "24px",
      }}
      aria-busy="true"
    >
      <p style={{ color: "rgba(0,0,0,0.58)" }}>Loading report {reportId} …</p>
    </main>
  );
}

/* ---- Main Print Page ---- */

export default function PrintReportPage({ params }: Props) {
  const { reportId } = use(params);
  const trpc = useTRPC();
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  useEffect(() => {
    if (weeklyQ.isError) {
      toast.error(
        weeklyQ.error instanceof Error
          ? `Failed to load report: ${weeklyQ.error.message}`
          : "Failed to load report",
      );
    }
  }, [weeklyQ.isError, weeklyQ.error]);

  if (weeklyQ.isLoading || !weeklyQ.data) {
    return <LoadingShell reportId={reportId} />;
  }

  // R3a: no-period sentinel — this page always has a reportId, so this
  // branch should not occur in practice, but guard for type safety.
  if (weeklyQ.data.status === "no-period") {
    return <LoadingShell reportId={reportId} />;
  }

  const view = mapWeeklyReport(weeklyQ.data);
  const portfolio: PortfolioProduct[] = view.portfolio as PortfolioProduct[];
  const products: ProductReport[] = view.products as ProductReport[];
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // Counts derived from re-sliced products.
  const blockedCount = products.filter((p) => p.status === "blocked").length;
  const atRiskCount = products.filter((p) => p.status === "at-risk").length;
  const decisionCount = products.reduce(
    (sum, p) => sum + p.decisions.length,
    0,
  );
  const submissionSummary = `${submitted}/${total} leads submitted`;
  const now = new Date().toISOString();

  return (
    <>
      {/* Print-specific styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { margin: 0; padding: 0; }
              nav, .no-print { display: none !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page-break-before { page-break-before: always; }
              section { page-break-inside: avoid; }
              table { page-break-inside: avoid; }
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          `,
        }}
      />

      <main
        style={{
          backgroundColor: "#ffffff",
          color: "rgba(0,0,0,0.87)",
          fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "12px",
          lineHeight: "1.5",
          letterSpacing: "-0.01em",
          maxWidth: "210mm",
          margin: "0 auto",
          padding: "24px",
        }}
      >
        {/* Company Header */}
        <header
          style={{
            textAlign: "center",
            marginBottom: "20px",
            paddingBottom: "12px",
            borderBottom: "3px solid #006241",
          }}
        >
          <h1
            style={{
              margin: "0 0 4px",
              fontSize: "20px",
              fontWeight: 600,
              color: "#006241",
              letterSpacing: "-0.16px",
            }}
          >
            Core Development — Status Report
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "rgba(0,0,0,0.58)",
            }}
          >
            {view.period.weekLabel} &middot; {view.period.dateRange} &middot;{" "}
            {submissionSummary}
          </p>
        </header>

        {/* Executive Summary */}
        <section style={{ marginBottom: "20px" }}>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#006241",
            }}
          >
            Executive Summary
          </h2>
          <div
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "11px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "20px", fontWeight: 600, color: "#006241" }}
              >
                {submitted}/{total}
              </div>
              <div style={{ color: "rgba(0,0,0,0.58)" }}>Submitted</div>
            </div>
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "20px", fontWeight: 600, color: "#c82014" }}
              >
                {blockedCount}
              </div>
              <div style={{ color: "rgba(0,0,0,0.58)" }}>Blocked</div>
            </div>
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "20px", fontWeight: 600, color: "#daa520" }}
              >
                {atRiskCount}
              </div>
              <div style={{ color: "rgba(0,0,0,0.58)" }}>At Risk</div>
            </div>
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "20px", fontWeight: 600, color: "#3730a3" }}
              >
                {decisionCount}
              </div>
              <div style={{ color: "rgba(0,0,0,0.58)" }}>Decisions</div>
            </div>
          </div>
        </section>

        {/* Portfolio Overview */}
        <section style={{ marginBottom: "20px" }}>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#006241",
            }}
          >
            Portfolio Overview
          </h2>
          <PortfolioTable products={portfolio} />
        </section>

        {/* Per-Product Sections */}
        <div className="page-break-before" />
        <section>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#006241",
            }}
          >
            Product Reports
          </h2>
          {products.map((report) => (
            <LeadSection key={report.id} report={report} />
          ))}
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: "24px",
            paddingTop: "8px",
            borderTop: "1px solid #e5e7eb",
            textAlign: "center",
            fontSize: "10px",
            color: "rgba(0,0,0,0.38)",
          }}
        >
          Generated {now} — Report ID: {reportId}
        </footer>
      </main>
    </>
  );
}
