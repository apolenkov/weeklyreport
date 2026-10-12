// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { PeriodStatus } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";

const queryState = vi.hoisted<{
  periodStatus: PeriodStatus;
  archived: boolean;
}>(() => ({
  periodStatus: "open",
  archived: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: { queryKey?: readonly unknown[] }) => {
    const key = options.queryKey?.[0];
    if (key === "weeklyReport.get") {
      return {
        data: {
          status: "active",
          ...makeWeeklyReportFixture({
            reportId: "report-001",
            periodStart: new Date("2026-06-08T00:00:00.000Z"),
            periodEnd: new Date("2026-06-14T00:00:00.000Z"),
            periodState: queryState.archived
              ? "archived"
              : queryState.periodStatus === "published"
                ? "published"
                : "open",
            periodStatus: queryState.periodStatus,
            archived: queryState.archived,
            submissionCount: 6,
            totalLeads: 8,
          }),
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

vi.mock("../../../shared/lib/auth/session-provider", () => ({
  useSession: () => ({ user: { role: "viewer" } }),
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
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

vi.mock("../../../shared/lib/errors/client-error-reporting", () => ({
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
  DocumentActionGroup: ({ children }: { children: React.ReactNode }) => (
    <div role="group" aria-label="Document actions">
      {children}
    </div>
  ),
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

vi.mock("../../report-pages", async () => ({
  WeeklyReportPage: (
    await import("../../report-pages/ui/weekly/weekly-report-page")
  ).WeeklyReportPage,
}));

vi.mock("../../report-pages/ui/weekly/use-weekly-report-page", () => ({
  useWeeklyReportPage: () => ({
    kind: "ready",
    reportId: "report-001",
    periodStatus: queryState.periodStatus,
    archived: queryState.archived,
    periodLabel: "Week 24, Jun 8–14, 2026",
    submitted: 6,
    total: 8,
    canMutatePeriod: false,
    periods: [],
    handlers: { setSubmissionFilter: vi.fn() },
    accordion: { products: [] },
  }),
}));

vi.mock("../../report-pages/ui/weekly/weekly-report-content", () => ({
  ReportContent: () => null,
}));

vi.mock("../../report-pages/ui/weekly/weekly-report-page-content", () => ({
  AcknowledgeSurface: () => null,
  CenteredNotice: () => null,
  ToolbarExportControl: () => null,
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
  queryState.archived = false;
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
      if (mode === "form" && periodStatus === "published") {
        expect(screen.getByText("Published · 6/8 Submitted")).toBeVisible();
        expect(screen.queryByText("Published")).not.toBeInTheDocument();
      } else {
        expect(screen.getByText(stateLabel)).toBeVisible();
      }
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
      if (mode === "slides") {
        expect(screen.getByText("Slides deck")).toBeVisible();
      }
    });
  },
);

it("keeps the archived document lifecycle and submission ratio without another status badge", () => {
  queryState.periodStatus = "published";
  queryState.archived = true;
  render(<ViewerReportShell reportId="report-001" mode="form" />);

  expect(screen.getByText("Archived · 6/8 Submitted")).toBeVisible();
  expect(screen.queryByText("Published")).not.toBeInTheDocument();
});
