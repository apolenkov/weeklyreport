import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AUTHOR_ID,
  expectReady,
  renderPageHook,
} from "./use-weekly-report-page.test-support";

describe("useWeeklyReportPage — memoized mapper chain — 1", () => {
  it.each(["published", "archived"] as const)(
    "fails closed on a %s report despite a reviewable target",
    async (lifecycle) => {
      const { result } = renderPageHook("head", true, AUTHOR_ID, {
        canReview: true,
        lifecycle,
      });
      expect(result.current.kind).toBe("loading");
      await waitFor(() => expectReady(result.current));
      expect(expectReady(result.current).reviewMode).toBe("read");
      expect(expectReady(result.current).reviewUnavailableNotice).toBe(
        "Review is unavailable for this section.",
      );
    },
  );
});
describe("useWeeklyReportPage — memoized mapper chain — 2", () => {
  it("follows URL history instead of retaining a stale local Review preference", async () => {
    const { result, rerender } = renderPageHook("head", true, AUTHOR_ID, {
      canReview: true,
    });
    await waitFor(() =>
      expect(expectReady(result.current).reviewMode).toBe("review"),
    );
    rerender(false);
    expect(expectReady(result.current).reviewMode).toBe("read");
    rerender(true);
    expect(expectReady(result.current).reviewMode).toBe("review");
  });
});
describe("useWeeklyReportPage — memoized mapper chain — 3", () => {
  it("accepts Review for the eligible submitted target without exposing drafts", async () => {
    const { result } = renderPageHook("head", true, AUTHOR_ID, {
      canReview: true,
    });
    await waitFor(() => expectReady(result.current));
    expect(expectReady(result.current).reviewMode).toBe("review");
    expect(expectReady(result.current).submissionFilter).toBe("submitted");
    expect(expectReady(result.current).reviewUnavailableNotice).toBeNull();
  });
});
describe("useWeeklyReportPage — memoized mapper chain — 4", () => {
  it("does not let another eligible section authorize an absent target", async () => {
    const { result } = renderPageHook("head", true, "missing-author", {
      canReview: true,
    });
    await waitFor(() => expectReady(result.current));
    expect(expectReady(result.current).reviewMode).toBe("read");
    expect(expectReady(result.current).reviewUnavailableNotice).toBe(
      "Review is unavailable for this section.",
    );
  });
});
describe("useWeeklyReportPage — memoized mapper chain — 5", () => {
  it("rejects targeted Review when the target lacks capability", async () => {
    const { result } = renderPageHook("head", true, AUTHOR_ID);
    await waitFor(() => expectReady(result.current));
    expect(expectReady(result.current).reviewMode).toBe("read");
    expect(expectReady(result.current).reviewUnavailableNotice).toBe(
      "Review is unavailable for this section.",
    );
  });
});
describe("useWeeklyReportPage — memoized mapper chain — 6", () => {
  it("keeps the same accordion object reference across a reviewMode-only re-render", async () => {
    const { result } = renderPageHook();

    await waitFor(() => {
      expectReady(result.current);
    });
    const before = expectReady(result.current);
    const accordionBefore = before.accordion;
    const reviewModelBefore = before.reviewModel;

    act(() => {
      expectReady(result.current).handlers.setReviewMode("review");
    });

    await waitFor(() => {
      expect(expectReady(result.current).reviewMode).toBe("review");
    });
    const after = expectReady(result.current);

    // Pure UI-toggle re-render: the memoized derivation must not recompute —
    // same object references, not merely equal-by-value.
    expect(after.accordion).toBe(accordionBefore);
    expect(after.reviewModel).toBe(reviewModelBefore);
  });
});
describe("useWeeklyReportPage — memoized mapper chain — 7", () => {
  it("recomputes the accordion when a data-dependent input (submissionFilter) changes", async () => {
    const { result } = renderPageHook();

    await waitFor(() => {
      expectReady(result.current);
    });
    const before = expectReady(result.current);
    const accordionBefore = before.accordion;
    expect(before.submissionFilter).toBe("submitted");

    act(() => {
      expectReady(result.current).handlers.setSubmissionFilter("all");
    });

    await waitFor(() => {
      expect(expectReady(result.current).submissionFilter).toBe("all");
    });
    const after = expectReady(result.current);

    expect(after.accordion).not.toBe(accordionBefore);
  });
});
