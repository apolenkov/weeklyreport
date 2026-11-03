// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shortItemLabel } from "../../../../shared/lib/format/short-label";
import type { WeeklyProductReport } from "../../../report-sections";
import type { AccordionReviewContext } from "../../../review";
import { AccordionSections } from "../product/accordion-sections";
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

vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: vi.fn(),
}));

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      comment: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: () => {
            submission.send();
            return submission.pending ?? Promise.resolve({});
          },
        }),
      },
      deleteComment: { mutationOptions: (options: object) => options },
    },
  }),
}));

vi.mock("./weekly-report-page-content", () => ({
  AcknowledgeSurface: () => null,
  ReportOverviewBand: () => null,
  ReviewModeVerdictSurface: () => null,
  ReportAccordionBody: ({
    scope,
    review,
  }: {
    readonly scope: string;
    readonly review: AccordionReviewContext | undefined;
  }) => (
    <AccordionSections
      key={scope}
      report={report}
      review={review}
      showNeedsAttention={false}
    />
  ),
}));

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

describe("Pending comment ownership", () => {
  it.each(["mode", "scope"])(
    "locks the same key after a %s remount and prevents duplicate sends",
    async (remount) => {
      let finish: () => void = () => {
        throw new Error("Missing submission");
      };
      submission.pending = new Promise((resolve) => {
        finish = () => resolve({});
      });
      const { rerender } = renderReport();
      fireEvent.change(firstComposer(), { target: { value: "Comment A" } });
      submitFirstComment();
      await waitFor(() => expect(submission.send).toHaveBeenCalledOnce());
      if (remount === "mode") {
        rerender({ reviewMode: "read" });
        rerender({});
      } else rerender({ scope: "lead" });
      expect(firstComposer()).toHaveValue("Comment A");
      expect(firstComposer()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
      submitFirstComment();
      finish();
      await waitFor(() => expect(firstComposer()).toBeEnabled());
      expect(submission.send).toHaveBeenCalledOnce();
      expect(firstComposer()).toHaveValue("");
      fireEvent.change(firstComposer(), { target: { value: "Comment B" } });
      rerender({});
      expect(firstComposer()).toHaveValue("Comment B");
    },
  );
});

describe("Head record comment drafts", () => {
  it("survives Review → Read → Review and scope remounts without mixing records", () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Keep this draft" } });
    rerender({ reviewMode: "read" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    rerender({ reviewMode: "review" });
    expect(firstComposer()).toHaveValue("Keep this draft");
    rerender({ scope: "lead" });
    expect(firstComposer()).toHaveValue("Keep this draft");
    expect(screen.getAllByRole("textbox")[1]).toHaveValue("");
  });

  it("isolates drafts by report and author and restores the original draft", () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Original report" } });
    rerender({ reportId: "report-2" });
    expect(firstComposer()).toHaveValue("");
    fireEvent.change(firstComposer(), { target: { value: "Second report" } });
    rerender({});
    expect(firstComposer()).toHaveValue("Original report");
    rerender({
      reviewModel: {
        ...props.reviewModel,
        context: {
          currentUserId: "head-2",
          isAdmin: false,
          onMutated: vi.fn(),
        },
      },
    });
    expect(firstComposer()).toHaveValue("");
    rerender({});
    expect(firstComposer()).toHaveValue("Original report");
  });

  it("clears a successfully submitted draft, including after remounting", async () => {
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Send this" } });
    const form = firstComposer().closest("form");
    if (!form) throw new Error("Expected comment form");
    fireEvent.submit(form);
    await waitFor(() => expect(firstComposer()).toHaveValue(""));
    rerender({ reviewMode: "read" });
    rerender({ scope: "lead" });
    expect(firstComposer()).toHaveValue("");
  });
});

describe("Head comment submission and risk names", () => {
  it("clears only the submitted report when success arrives after navigation", async () => {
    let finish: () => void = () => {
      throw new Error("Missing submission");
    };
    submission.pending = new Promise((resolve) => {
      finish = () => resolve({});
    });
    const { rerender } = renderReport();
    fireEvent.change(firstComposer(), { target: { value: "Send original" } });
    const form = firstComposer().closest("form");
    if (!form) throw new Error("Expected comment form");
    fireEvent.submit(form);
    rerender({ reportId: "report-2" });
    fireEvent.change(firstComposer(), { target: { value: "Keep second" } });
    finish();
    await waitFor(() => expect(firstComposer()).toHaveValue("Keep second"));
    rerender({});
    await waitFor(() => expect(firstComposer()).toHaveValue(""));
    submission.pending = null;
  });

  it("names two risk composers distinctly even when short excerpts match", () => {
    renderReport();
    const excerpt = shortItemLabel(commonStart);
    for (const id of riskIds) {
      expect(
        screen.getByRole("textbox", {
          name: `Add a review comment on ${excerpt} (risk ${id})`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: `Comment on ${excerpt} (risk ${id})`,
        }),
      ).toBeInTheDocument();
    }
  });
});
