/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import type { SectionReviewView } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { resolveBadge, SectionVerdictControl } from "./section-verdict-control";

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      verdict: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: () =>
            Promise.resolve({ unsubmitted: false, verdict: "approved" }),
        }),
      },
    },
  }),
}));

function renderWithClient(ui: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

function renderControl(canReview: boolean) {
  return renderWithClient(
    <SectionVerdictControl
      reportSectionId="11111111-1111-4111-8111-111111111111"
      version={1}
      reviews={[]}
      canReview={canReview}
      onMutated={vi.fn()}
    />,
  );
}

const review = (
  verdict: SectionReviewView["verdict"],
  isCurrent: boolean,
): SectionReviewView => ({
  reviewerId: "11111111-1111-4111-8111-111111111112",
  reviewerName: "Reviewer",
  verdict,
  judgedVersion: 1,
  isCurrent,
  createdAt: new Date("2026-07-22T12:00:00.000Z"),
});

describe("resolveBadge", () => {
  it("filters stale verdicts into the awaiting state", () => {
    expect(resolveBadge([review("changes_requested", false)])).toEqual({
      kind: "awaiting",
      label: "Awaiting review",
    });
  });

  it("ranks current changes requested above current approval", () => {
    expect(
      resolveBadge([
        review("approved", true),
        review("changes_requested", true),
      ]),
    ).toEqual({ kind: "changes", label: "Changes requested" });
  });

  it("distinguishes no verdicts from an explicit awaiting state", () => {
    expect(resolveBadge([])).toEqual({
      kind: "none",
      label: "Not reviewed",
    });
    expect(resolveBadge([review("approved", false)])).toEqual({
      kind: "awaiting",
      label: "Awaiting review",
    });
  });
});

describe("SectionVerdictControl — verdict buttons", () => {
  it("renders Approve / Request changes only for a designated reviewer", () => {
    renderControl(false);
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("both verdict buttons floor at the touch target below md (responsive-compact-layout)", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // The pills keep their desktop density (py-0.5, ~21px) and only the hit
    // area grows on the phone-floored review surface.
    renderControl(true);

    const approve = screen.getByRole("button", { name: "Approve" });
    const requestChanges = screen.getByRole("button", {
      name: "Request changes",
    });
    for (const button of [approve, requestChanges]) {
      expect(button.className).toContain(
        "max-md:min-h-[var(--touch-target-min)]",
      );
    }
  });
});
