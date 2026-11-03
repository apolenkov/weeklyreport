// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { ReviewModel } from "../../../review";
import {
  ReportAccordionBody,
  ReviewModeVerdictSurface,
} from "./weekly-report-page-content";

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
  it("keeps a pending verdict locked when its control remounts in Leads", async () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["review", "verdict"], mutation: true },
    ]);
    const mutation = captured["review.verdict"];
    if (!mutation) throw new Error("Missing verdict mutation");
    mutation.mutationFn.mockReturnValue(new Promise(() => undefined));
    const client = new QueryClient();
    const tree = (scope: "product" | "lead") => (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          {scope === "product" ? (
            <ReviewModeVerdictSurface
              reportId="report-a"
              reviewModel={model(SUBMITTED)}
              reviewMode="review"
            />
          ) : (
            <ReportAccordionBody
              scope="lead"
              products={[]}
              leadGroups={[{ id: "ada", name: "Ada Lovelace", products: [] }]}
              focusedProductId={undefined}
              scrollTargetProductId={undefined}
              focusedLeadId={undefined}
              overviewNavigationEpochs={new Map()}
              review={model(SUBMITTED).context}
              reviewModel={model(SUBMITTED)}
              activitySections={[
                makeReportSectionFixture({
                  reportSectionId: "aaaaaaaa-1111-4111-8111-111111111111",
                  authorId: "ada",
                }),
              ]}
            />
          )}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree("product"));
    fireEvent.click(
      screen.getByRole("button", { name: "Approve Ada Lovelace" }),
    );
    await waitFor(() => expect(mutation.mutationFn).toHaveBeenCalledOnce());
    rerender(tree("lead"));
    const saving = screen.getByRole("button", {
      name: "Saving verdict for Ada Lovelace",
    });
    expect(saving).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(saving);
    expect(mutation.mutationFn).toHaveBeenCalledOnce();
  });

  it("places one verdict beside an empty submitted author's section heading", () => {
    const { proxy } = createMockTRPC([
      { path: ["review", "verdict"], mutation: true },
    ]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TRPCProxyContext.Provider value={proxy}>
          <ReportAccordionBody
            scope="lead"
            products={[]}
            leadGroups={[{ id: "ada", name: "Ada Lovelace", products: [] }]}
            focusedProductId={undefined}
            scrollTargetProductId={undefined}
            focusedLeadId={undefined}
            overviewNavigationEpochs={new Map()}
            review={model(SUBMITTED).context}
            reviewModel={model(SUBMITTED)}
            activitySections={[
              makeReportSectionFixture({
                reportSectionId: "aaaaaaaa-1111-4111-8111-111111111111",
                authorId: "ada",
              }),
            ]}
          />
        </TRPCProxyContext.Provider>
      </QueryClientProvider>,
    );
    expect(
      screen.getAllByRole("button", { name: "Approve Ada Lovelace" }),
    ).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Ada L." })).toContainElement(
      screen.getByRole("button", { name: "Approve Ada Lovelace" }),
    );
  });
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
