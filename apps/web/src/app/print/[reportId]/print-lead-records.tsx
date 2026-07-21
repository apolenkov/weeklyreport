import type { CSSProperties } from "react";

import type { WeeklyProductReport } from "../../../features/report-sections/model/weekly-report-types";
import {
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

export function RiskRecords({ report }: RecordListProps) {
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

export function DecisionRecords({ report }: RecordListProps) {
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
