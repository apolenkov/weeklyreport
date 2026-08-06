// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./record-comments", () => ({
  RecordComments: ({ currentUserId }: { readonly currentUserId: string }) => (
    <div data-testid="record-comments">{currentUserId}</div>
  ),
}));

import { ReviewedRow } from "./reviewed-row";

const review = {
  currentUserId: "11111111-1111-4111-8111-111111111111",
  isAdmin: false,
  onMutated: vi.fn(),
};

describe("ReviewedRow", () => {
  it("always renders the row and mounts comments only when review content exists", () => {
    const { rerender } = render(
      <ReviewedRow
        review={review}
        anchor={{ itemId: "22222222-2222-4222-8222-222222222222" }}
        record={{ comments: [], canReview: false }}
      >
        <span>row</span>
      </ReviewedRow>,
    );

    expect(screen.getByText("row")).toBeInTheDocument();
    expect(screen.queryByTestId("record-comments")).not.toBeInTheDocument();

    rerender(
      <ReviewedRow
        review={review}
        anchor={{ itemId: "22222222-2222-4222-8222-222222222222" }}
        record={{ comments: [], canReview: true }}
      >
        <span>row</span>
      </ReviewedRow>,
    );

    expect(screen.getByTestId("record-comments")).toHaveTextContent(
      review.currentUserId,
    );
  });

  it("does not mount comments when the review context is absent", () => {
    render(
      <ReviewedRow
        review={undefined}
        anchor={{ riskId: "33333333-3333-4333-8333-333333333333" }}
        record={{ comments: [], canReview: true }}
      >
        <span>row</span>
      </ReviewedRow>,
    );

    expect(screen.getByText("row")).toBeInTheDocument();
    expect(screen.queryByTestId("record-comments")).not.toBeInTheDocument();
  });
});
