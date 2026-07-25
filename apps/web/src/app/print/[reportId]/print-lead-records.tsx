import type { CSSProperties } from "react";

import type { WeeklyProductReport } from "../../../features/report-sections/model/weekly-report-types";
import {
  printStatusColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  workflowBadge,
} from "./print-report-theme";

interface RecordListProps {
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

// Soft badge fills (text colors reuse printStatusColor where they match).
const BADGE_BG = {
  completed: "#d4e9e2",
  blocked: "#fde8e8",
  default: "#f0f0f0",
  atRisk: "#fef9e7",
  decision: "#e0e7ff",
} as const;
const BADGE_TEXT_AT_RISK = "#b45309";
const BADGE_TEXT_DECISION = "#3730a3";

const BADGE_BASE: CSSProperties = {
  fontSize: "9px",
  padding: "1px 4px",
  borderRadius: "4px",
};

function workflowStatusBadgeStyle(status: string): CSSProperties {
  if (status === "completed") {
    return {
      ...BADGE_BASE,
      backgroundColor: BADGE_BG.completed,
      color: printStatusColor("on-track"),
    };
  }
  if (status === "blocked") {
    return {
      ...BADGE_BASE,
      backgroundColor: BADGE_BG.blocked,
      color: printStatusColor("blocked"),
    };
  }
  return {
    ...BADGE_BASE,
    backgroundColor: BADGE_BG.default,
    color: TEXT_SECONDARY,
  };
}

function severityBadgeStyle(severity: string): CSSProperties {
  const blocked = severity === "blocked";
  return {
    ...BADGE_BASE,
    backgroundColor: blocked ? BADGE_BG.blocked : BADGE_BG.atRisk,
    color: blocked ? printStatusColor("blocked") : BADGE_TEXT_AT_RISK,
    fontWeight: 600,
  };
}

const DECISION_BADGE_STYLE: CSSProperties = {
  ...BADGE_BASE,
  backgroundColor: BADGE_BG.decision,
  color: BADGE_TEXT_DECISION,
  fontWeight: 600,
};

/**
 * Current Week Records.
 * @param props - The props argument.
 */
export function CurrentWeekRecords({ report }: RecordListProps) {
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
            <span style={workflowStatusBadgeStyle(item.status)}>
              {workflowBadge(item.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Next Week Records.
 * @param props - The props argument.
 */
export function NextWeekRecords({ report }: RecordListProps) {
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

/**
 * Risk Records.
 * @param props - The props argument.
 */
export function RiskRecords({ report }: RecordListProps) {
  if (report.risks.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={{ ...RECORD_TITLE_STYLE, color: printStatusColor("blocked") }}>
        Risks & Blockers
      </h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.risks.map((risk) => (
          <li key={risk.id}>
            <span style={severityBadgeStyle(risk.severity)}>{risk.badge}</span>{" "}
            {risk.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Decision Records.
 * @param props - The props argument.
 */
export function DecisionRecords({ report }: RecordListProps) {
  if (report.decisions.length === 0) return null;
  return (
    <div style={RECORD_GROUP_STYLE}>
      <h4 style={RECORD_TITLE_STYLE}>Decisions Needed</h4>
      <ul style={RECORD_LIST_STYLE}>
        {report.decisions.map((decision) => (
          <li key={decision.id}>
            <span style={DECISION_BADGE_STYLE}>{decision.badge}</span>{" "}
            {decision.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Priority Records.
 * @param props - The props argument.
 */
export function PriorityRecords({ report }: RecordListProps) {
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
