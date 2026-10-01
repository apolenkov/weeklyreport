// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import type { ReviewModel } from "../../../review";
import { ReviewModeVerdictSurface } from "./weekly-report-page-content";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const model = (sections: ReviewModel["sections"]): ReviewModel => ({
  context: {
    currentUserId: "reviewer-1",
    isAdmin: false,
    onMutated: vi.fn(),
  },
  groups: [],
  sections,
  isHeadOrAdmin: false,
});

const SUBMITTED: ReviewModel["sections"] = [
  {
    reportSectionId: "aaaaaaaa-1111-4111-8111-111111111111",
    version: 1,
    authorName: "Ada Lovelace",
    status: "submitted",
    reviews: [],
    canReview: true,
    groupId: null,
  },
];

function renderSurface(reportId: string, reviewModel: ReviewModel) {
  const { proxy } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);
  const client = new QueryClient();
  const tree = (id: string, current: ReviewModel): ReactNode => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        <ReviewModeVerdictSurface
          reportId={id}
          reviewModel={current}
          reviewMode="review"
        />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(reportId, reviewModel));
  return (id: string, current: ReviewModel) => {
    rerender(tree(id, current));
  };
}

describe("ReviewModeVerdictSurface", () => {
  it("renders nothing for another report that has no reviewable section", () => {
    const switchReport = renderSurface("report-a", model(SUBMITTED));
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();

    switchReport("report-b", model([]));

    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the band after the last row of the same report is actioned", () => {
    const switchReport = renderSurface("report-a", model(SUBMITTED));

    switchReport("report-a", model([]));

    expect(
      screen.getByText("No submitted sections left to review."),
    ).toBeInTheDocument();
  });
});
