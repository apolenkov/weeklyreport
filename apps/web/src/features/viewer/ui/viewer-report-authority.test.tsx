// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { PeriodStatus } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted<{ periodStatus: PeriodStatus }>(() => ({
  periodStatus: "open",
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: { queryKey?: readonly unknown[] }) => {
    const key = options.queryKey?.[0];
    if (key === "weeklyReport.get") {
      return {
        data: {
          status: "active",
          reportId: "report-001",
          periodStart: "2026-06-08T00:00:00.000Z",
          periodEnd: "2026-06-14T00:00:00.000Z",
          periodStatus: queryState.periodStatus,
        },
        isError: false,
        error: null,
      };
    }
    if (key === "reports.compiledHistory") {
      return { data: { entries: [] }, isError: false, error: null };
    }
    // An unintended query or changed key must fail loudly, not be absorbed
    // as an empty successful payload.
    throw new Error(
      `Unexpected query key in viewer authority mock: ${String(key)}`,
    );
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: () => ({ queryKey: ["weeklyReport.get"] }),
      },
    },
  }),
}));

vi.mock("../../../lib/client-error-reporting", () => ({
  getClientErrorDetails: () => ({ isInvalidLink: false }),
}));

vi.mock("../../../shared/ui/report-shell/use-report-shell-url-state", () => ({
  useReportShellUrlState: () => ({
    buildQuery: ({ mode }: { mode?: string | null }) =>
      mode === "slides" ? "?mode=slides" : "",
    includeArchive: false,
    setIncludeArchive: vi.fn(),
    scope: "product",
    setScope: vi.fn(),
  }),
}));

vi.mock("../../../shared/ui/report-shell/report-toolbar", () => ({
  ReportToolbar: ({
    contextControls,
  }: {
    contextControls?: React.ReactNode;
  }) => (
    <div role="group" aria-label="Context controls">
      {contextControls}
    </div>
  ),
}));

vi.mock("../../../shared/ui/report-shell/archive-toggle", () => ({
  ArchiveToggle: () => <span>Archive filter</span>,
}));

vi.mock("../../../shared/ui/report-shell/scope-toggle", () => ({
  ScopeToggle: () => <span>Report scope</span>,
}));

vi.mock("../../../shared/ui/report-shell/view-mode-toggle", () => ({
  ViewModeToggle: ({ readOnly }: { readOnly?: boolean }) => (
    <nav>
      <a href="/reports/report-001">{readOnly ? "Report" : "Edit"}</a>
      <a href="/reports/report-001?mode=slides">Slides</a>
    </nav>
  ),
}));

vi.mock("../../../shared/ui/report-shell/agent-review-coming-soon", () => ({
  AgentReviewComingSoon: () => <span>Agent review</span>,
}));

vi.mock("../../period", () => ({
  PeriodNavigator: () => null,
}));

vi.mock("../../pdf-export", () => ({
  ExportPdfButton: () => <button type="button">Export PDF</button>,
}));

vi.mock("../../slides", () => ({
  HeadSlidesClient: () => <div>Slides deck</div>,
  SlideSkeleton: () => <div>Loading slides</div>,
}));

vi.mock("../../report-pages", () => ({
  WeeklyReportPage: ({
    documentActionsLeading,
    contextControls,
    headerContextLabel,
  }: {
    readonly documentActionsLeading?: React.ReactNode;
    readonly contextControls?: React.ReactNode;
    readonly headerContextLabel?: React.ReactNode;
  }) => (
    <div>
      <header>
        <h1>Status Report</h1>
        {headerContextLabel}
        {documentActionsLeading}
      </header>
      {contextControls}
    </div>
  ),
}));

import { ViewerReportShell } from "./viewer-report-shell";

const AUTHORITY_CASES = [
  { periodStatus: "open", stateLabel: "Draft", working: true },
  { periodStatus: "reopened", stateLabel: "Reopened", working: true },
  { periodStatus: "published", stateLabel: "Published", working: false },
] as const;

const MODES = ["form", "slides"] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(AUTHORITY_CASES)(
  "ViewerReportShell — $periodStatus authority",
  ({ periodStatus, stateLabel, working }) => {
    it.each(MODES)("labels the %s header without mutation controls", (mode) => {
      queryState.periodStatus = periodStatus;
      render(<ViewerReportShell reportId="report-001" mode={mode} />);

      expect(
        screen.getByRole("heading", { name: "Status Report" }),
      ).toBeVisible();
      expect(screen.getByText(stateLabel)).toBeVisible();
      const banner = screen.queryByText("Working report — includes drafts");
      expect(banner ? banner.textContent : null).toBe(
        working ? "Working report — includes drafts" : null,
      );
      expect(
        screen.queryByRole("button", {
          name: /edit|submit|publish|reopen|move.*archive/i,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Edit" }),
      ).not.toBeInTheDocument();
    });
  },
);
