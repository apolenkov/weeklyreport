import {
  printStatusColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./print-report-theme";

// Error heading uses the blocked/danger red from the print status palette.
const ERROR_HEADING_COLOR = printStatusColor("blocked");

export const PRINT_STATE = {
  loading: "loading",
  error: "error",
  ready: "ready",
} as const;

// A4 portrait width: the shell must not exceed the print page it renders onto.
const A4_PAGE_WIDTH = "210mm";

export const SHELL_STYLE = {
  backgroundColor: "#ffffff",
  color: TEXT_PRIMARY,
  fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "12px",
  maxWidth: A4_PAGE_WIDTH,
  margin: "0 auto",
  padding: "24px",
} as const;

interface PrintReportShellProps {
  readonly reportId: string;
}

export function LoadingShell({ reportId }: PrintReportShellProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-print-state={PRINT_STATE.loading}
      style={SHELL_STYLE}
      aria-busy="true"
    >
      <p style={{ color: TEXT_SECONDARY }}>Loading report {reportId} …</p>
    </main>
  );
}

export function ErrorShell({ reportId }: PrintReportShellProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-print-state={PRINT_STATE.error}
      style={SHELL_STYLE}
      role="alert"
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "16px",
          color: ERROR_HEADING_COLOR,
        }}
      >
        Report could not be rendered
      </h1>
      <p style={{ color: TEXT_SECONDARY }}>
        Report {reportId} failed to load and cannot be exported.
      </p>
    </main>
  );
}
