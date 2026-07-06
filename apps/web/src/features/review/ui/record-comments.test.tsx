/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import type { RecordCommentView } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { RecordComments } from "./record-comments";

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      comment: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: () => Promise.resolve({}),
        }),
      },
      deleteComment: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: () => Promise.resolve({}),
        }),
      },
    },
  }),
}));

const REVIEWER_ID = "22222222-2222-4222-8222-222222222222";

const OWN_COMMENT: RecordCommentView = {
  id: "33333333-3333-4333-8333-333333333333",
  reviewerId: REVIEWER_ID,
  reviewerName: "Head Reviewer",
  text: "Please split this item.",
  createdAt: new Date("2026-07-01T10:00:00Z"),
};

function renderWithClient(ui: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

function renderComments() {
  return renderWithClient(
    <RecordComments
      anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
      comments={[OWN_COMMENT]}
      canReview
      currentUserId={REVIEWER_ID}
      isAdmin={false}
      onMutated={vi.fn()}
    />,
  );
}

describe("RecordComments — compact touch floor (responsive-compact-layout)", () => {
  // jsdom cannot evaluate media queries; the class assertions are the teeth.
  it("the per-comment Delete text-link floors its hit area below md", () => {
    renderComments();

    const deleteLink = screen.getByRole("button", { name: "Delete comment" });
    // Visually it stays a text link; only the hit area grows on phones.
    expect(deleteLink.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
    expect(deleteLink.className).toContain(
      "max-md:min-w-[var(--touch-target-min)]",
    );
  });

  it("the composer submit button floors at the touch target below md", () => {
    renderComments();

    const submit = screen.getByRole("button", { name: "Comment" });
    expect(submit.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});
