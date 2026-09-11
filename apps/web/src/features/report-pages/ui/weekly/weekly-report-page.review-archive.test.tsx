// Review, acknowledgement, and archive behavior through the page harness.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// We mock cache-keys to verify invalidation cascade without actually inspecting
// react-query internals.
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: vi.fn(),
  },
}));

// Mock Next.js navigation hooks consumed by the fallback PeriodNavigator. We
// don't drive route changes in these tests — just neutralize the hook calls.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import { invalidatePeriodLifecycle } from "../../../../shared/lib/query/cache-keys";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import {
  makeWeeklyReportData,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

const REVIEW_COMMENT_TEXT = "Please double-check the milestone date";

// A live open period whose section the caller may review, mirroring the
// server-stamped `canReview` a head/designated reviewer receives. The reviewer
// comment makes the read-only vs review-mode split observable.
function makeReviewableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeWeeklyReportData("open");
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      version: 1,
      reviews: [],
      canReview: true,
      // No group id keeps the per-group Acknowledge bar inert; the review-mode
      // split under test is independent of acknowledgement.
      groupId: null,
      items: section.items.map((item) => ({
        ...item,
        comments: [
          {
            id: "44444444-4444-4444-8444-aaaaaaaaaa01",
            reviewerId: "head-user-id",
            reviewerName: "Test User",
            text: REVIEW_COMMENT_TEXT,
            createdAt: new Date("2026-04-15T10:00:00Z"),
          },
        ],
      })),
    })),
  };
}

function makeDraftOnlyReviewableData(): ReturnType<
  typeof makeWeeklyReportData
> {
  const base = makeReviewableData();
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      status: "draft" as const,
      submittedAt: null,
    })),
  };
}

function makeMixedReviewableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeReviewableData();
  const submittedSection = base.leadSections.at(0);
  if (!submittedSection) {
    throw new Error("Expected a reviewable section fixture");
  }
  const draftSection = {
    ...submittedSection,
    reportSectionId: "22222222-2222-4222-8222-bbbbbbbbbbb2",
    authorId: "11111111-1111-4111-8111-bbbbbbbbbbbb",
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
  };
  return { ...base, leadSections: [...base.leadSections, draftSection] };
}

describe("WeeklyReportPage — review-mode split (report-review-mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("defaults to read mode: the toggle shows for a reviewer but affordances stay hidden", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "head" });

    expect(
      await screen.findByRole("button", { name: "Review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Read mode renders read-only content — no verdict control, no composer, no
    // reviewer comments.
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Add a review comment"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(REVIEW_COMMENT_TEXT)).not.toBeInTheDocument();
    // The roll-up strip renders on the dashboard, not inside the report body.
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });

  it("mounts the verdict control and comment composer once switched to review mode", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "head" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Add a review comment")).toBeInTheDocument();
    expect(screen.getByText(REVIEW_COMMENT_TEXT)).toBeInTheDocument();
    // The in-body verdict band is the designated viewer-reviewer's verdict home.
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });

  it("gives a designated viewer-reviewer the in-body verdict home (not stranded by the head-only strip)", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "viewer" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });

  it("offers no review-mode toggle to a lead", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "lead" });

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Read" }),
    ).not.toBeInTheDocument();
  });

  it("offers no review-mode toggle for draft-only review capability", async () => {
    renderWeeklyReportPage(makeDraftOnlyReviewableData(), { role: "head" });

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });

  it("keeps mixed review state limited to submitted sections", async () => {
    renderWeeklyReportPage(makeMixedReviewableData(), { role: "head" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    const band = await screen.findByRole("region", { name: "Section reviews" });
    expect(within(band).getByText("Alice")).toBeInTheDocument();
    expect(within(band).queryByText("Bob")).not.toBeInTheDocument();
    expect(
      within(band).getAllByRole("button", { name: "Approve" }),
    ).toHaveLength(1);
  });
});

// makeReviewableData with a real group id, so the Acknowledge control mounts.
function makeAcknowledgeableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeReviewableData();
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      groupId: "99999999-9999-4999-8999-999999999901",
      groupName: "Core Development",
    })),
  };
}

describe("WeeklyReportPage — acknowledge placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("head: Acknowledge sits in the publish cluster on the header, not as a body band", async () => {
    renderWeeklyReportPage(makeAcknowledgeableData(), { role: "head" });

    const cluster = await screen.findByTestId("acknowledge-header");
    expect(
      within(cluster).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-body")).not.toBeInTheDocument();
    // Acknowledgement never gates publish: the lifecycle button still renders
    // alongside, un-acknowledged.
    expect(
      screen.getByRole("button", { name: /publish/i }),
    ).toBeInTheDocument();
  });

  it("viewer: Acknowledge stays a body band (no publish cluster to host it)", async () => {
    renderWeeklyReportPage(makeAcknowledgeableData(), { role: "viewer" });

    const band = await screen.findByTestId("acknowledge-body");
    expect(
      within(band).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-header")).not.toBeInTheDocument();
  });
});

describe("WeeklyReportPage — Archive / Restore wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const ARCHIVE_BUTTON = /move this report to the archive/i;
  const RESTORE_BUTTON = /restore this report from the archive/i;

  it("offers Archive, not Restore, on a published report still out of the archive", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("published"));

    expect(
      await screen.findByRole("button", { name: ARCHIVE_BUTTON }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("offers neither control while the period is still open", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"));

    await screen.findByRole("button", { name: /publish & lock/i });
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: RESTORE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("swaps Archive for Restore once the report is archived", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });

    expect(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    ).toBeInTheDocument();
    // Archiving leaves periodStatus published, so the Archive button would
    // still match its old gate — offering it again could only fail.
    expect(
      screen.queryByRole("button", { name: ARCHIVE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("clicking Restore fires archive.unarchiveReport with the report id", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    const restoreMutation = expectDefined(captured["archive.unarchiveReport"]);
    await waitFor(() => {
      expect(restoreMutation.mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(restoreMutation.mutationFn.mock.calls[0]?.[0]).toEqual({
      reportId: REPORT_ID,
    });
  });

  it("restore busts the same caches archive does and confirms with a toast", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockResolvedValue({ success: true });

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(invalidatePeriodLifecycle).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Report restored");
    // Restore only moves the report between lists; it changes no section data.
  });

  it("surfaces a failed restore as an error toast", async () => {
    const { captured } = renderWeeklyReportPage({
      ...makeWeeklyReportData("published"),
      archived: true,
    });
    expectDefined(
      captured["archive.unarchiveReport"],
    ).mutationFn.mockRejectedValue(new TRPCClientError("Report not found"));

    await userEvent.click(
      await screen.findByRole("button", { name: RESTORE_BUTTON }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Report not found");
    });
    expect(invalidatePeriodLifecycle).not.toHaveBeenCalled();
  });
});
