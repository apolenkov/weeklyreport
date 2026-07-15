import type { CSSProperties } from "react";

import type { WeeklyProductReport } from "../../../features/report-sections/model/weekly-report-types";
import {
  printStatusColor,
  printStatusLabel,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  workflowBadge,
} from "./print-report-theme";

interface PrintLeadSectionProps {
  readonly report: WeeklyProductReport;
}

const RECORD_GROUP_STYLE: CSSProperties = { marginBottom: "6px" };
const RECORD_TITLE_STYLE: CSSProperties = {
  margin: "0 0 4px",
  fontSize: "11px",
  fontWeight: 600,
  color: TEXT_PRIMARY,
};
const RECORD_LIST_STYLE: CSSProperties = {
  margin: 0,
  paddingLeft: "16px",
  fontSize: "11px",
  lineHeight: "1.6",
};
const LEAD_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
  paddingBottom: "4px",
  borderBottom: "2px solid #006241",
};
const LEAD_INITIALS_STYLE: CSSProperties = {
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
};

function PrintLeadHeader({ report }: PrintLeadSectionProps) {
  return (
    <div style={LEAD_HEADER_STYLE}>
      <span style={LEAD_INITIALS_STYLE}>{report.initials}</span>
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
          backgroundColor: printStatusColor(report.status),
        }}
      >
        {printStatusLabel(report.status)}
      </span>
      <span
        style={{ fontSize: "11px", color: TEXT_SECONDARY, marginLeft: "auto" }}
      >
        {report.leads}
      </span>
    </div>
  );
}

function PrintNeedsAttention({ report }: PrintLeadSectionProps) {
  if (!report.needsAttention) return null;
  return (
    <div
      style={{
        padding: "6px 10px",
        marginBottom: "8px",
        borderLeft: `3px solid ${printStatusColor(report.needsAttentionSeverity ?? "at-risk")}`,
        backgroundColor: "#fef9e7",
        fontSize: "11px",
      }}
    >
      {report.needsAttention}
    </div>
  );
}

function CurrentWeekRecords({ report }: PrintLeadSectionProps) {
  if (report.currentWeek.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={RECORD_TITLE_STYLE}>Current Week</h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.currentWeek.map((item) => (
          <li key={item.id}>
            <span style={{ color: TEXT_SECONDARY, fontSize: "10px" }}>
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
                      : TEXT_SECONDARY,
              }}
            >
              {workflowBadge(item.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextWeekRecords({ report }: PrintLeadSectionProps) {
  if (report.nextWeek.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={RECORD_TITLE_STYLE}>Next Week</h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.nextWeek.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </div>
  );
}

function RiskRecords({ report }: PrintLeadSectionProps) {
  if (report.risks.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={{ ...RECORD_TITLE_STYLE, color: "#c82014" }}>
        Risks & Blockers
      </h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.risks.map((risk) => (
          <li key={risk.id}>
            <span
              style={{
                fontSize: "9px",
                padding: "1px 4px",
                borderRadius: "4px",
                backgroundColor:
                  risk.severity === "blocked" ? "#fde8e8" : "#fef9e7",
                color: risk.severity === "blocked" ? "#c82014" : "#b45309",
                fontWeight: 600,
              }}
            >
              {risk.badge}
            </span>{" "}
            {risk.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecisionRecords({ report }: PrintLeadSectionProps) {
  if (report.decisions.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={RECORD_TITLE_STYLE}>Decisions Needed</h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.decisions.map((decision) => (
          <li key={decision.id}>
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
              {decision.badge}
            </span>{" "}
            {decision.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriorityRecords({ report }: PrintLeadSectionProps) {
  if (report.priorities.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={RECORD_TITLE_STYLE}>Priorities</h4>
      <ol style={RECORD_LIST_STYLE}>
        {report.priorities.map((priority, index) => (
          // eslint-disable-next-line react/no-array-index-key -- ranks can repeat; index disambiguates this stable render-only list
          <li key={`${priority.rank}-${index}`} value={priority.rank}>
            {priority.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PrintLeadSection({ report }: PrintLeadSectionProps) {
  return (
    <section style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
      <PrintLeadHeader report={report} />
      <PrintNeedsAttention report={report} />
      <CurrentWeekRecords report={report} />
      <NextWeekRecords report={report} />
      <RiskRecords report={report} />
      <DecisionRecords report={report} />
      <PriorityRecords report={report} />
    </section>
  );
}
