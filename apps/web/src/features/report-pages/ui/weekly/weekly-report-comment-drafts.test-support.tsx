// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import type { WeeklyProductReport } from "../../../report-sections";
import {
  ReportContent,
  type ReportContentProps,
} from "./weekly-report-content";

const submission = vi.hoisted(() => ({
  pending: null as Promise<object> | null,
  send: vi.fn(),
}));

afterEach(() => {
  submission.pending = null;
  submission.send.mockClear();
});

const riskIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
const commonStart =
  "The vendor delivery is delayed and the release is blocked ".repeat(2);
const report: WeeklyProductReport = {
  id: "product-1",
  authorIds: ["lead-1"],
  initials: "PA",
  name: "Product Alpha",
  status: "on-track",
  statusLabel: "On track",
  leads: "Alice",
  currentWeek: [],
  nextWeek: [],
  risks: riskIds.map((id, index) => ({
    id,
    badge: "Risk",
    stage: "Development",
    owner: "AL",
    severity: "at-risk",
    text: `${commonStart}${index}`,
    problem: `${commonStart}${index}`,
    impact: "Release delayed",
    mitigation: "Contact vendor",
    canReview: true,
  })),
  decisions: [],
  priorities: [],
};

const props: ReportContentProps = {
  hasAnyContent: true,
  submissionCount: 1,
  periodLabel: "Current week",
  scope: "product",
  activitySections: [],
  portfolio: [],
  leadOverviewRows: [],
  reviewModel: {
    context: { currentUserId: "head-1", isAdmin: false, onMutated: vi.fn() },
    groups: [],
    sections: [],
    isHeadOrAdmin: true,
  },
  reportId: "report-1",
  accordion: {
    products: [],
    leadGroups: [],
    hasAnyContent: true,
    draftCount: 0,
  },
  reviewEnabled: true,
  canReviewAny: true,
  reviewMode: "review",
  onReviewModeChange: vi.fn(),
  submittedOnly: false,
  submissionFilter: "all",
  onFilterChange: vi.fn(),
  focusedProductId: undefined,
  scrollTargetProductId: undefined,
  focusedLeadId: undefined,
  overviewNavigationEpochs: new Map(),
  onNavigateOverview: vi.fn(),
};

function renderReport() {
  const client = new QueryClient();
  const view = (overrides: Partial<ReportContentProps> = {}) => (
    <QueryClientProvider client={client}>
      <ReportContent {...props} {...overrides} />
    </QueryClientProvider>
  );
  const rendered = render(view());
  return {
    rerender: (overrides: Partial<ReportContentProps>) =>
      rendered.rerender(view(overrides)),
  };
}

function firstComposer() {
  const composer = screen.getAllByRole("textbox")[0];
  if (!composer) throw new Error("Expected a review composer");
  return composer;
}

function submitFirstComment() {
  const form = firstComposer().closest("form");
  if (!form) throw new Error("Expected comment form");
  fireEvent.submit(form);
}
export {
  commonStart,
  firstComposer,
  props,
  renderReport,
  report,
  riskIds,
  submission,
  submitFirstComment,
};
