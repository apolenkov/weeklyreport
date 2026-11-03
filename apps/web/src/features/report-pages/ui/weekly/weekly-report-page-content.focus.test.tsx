// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { ReportAccordionBody } from "./weekly-report-page-content";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: vi.fn(),
}));

const sectionId = "aaaaaaaa-1111-4111-8111-111111111111";

function setup(removeAuthor: boolean) {
  const { proxy, captured } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);
  const mutation = captured["review.verdict"];
  if (!mutation) throw new Error("Missing verdict mutation");
  mutation.mutationFn.mockResolvedValue({
    verdict: "changes_requested",
    unsubmitted: true,
    judgedVersion: 1,
  });
  function Body() {
    const [submitted, setSubmitted] = useState(true);
    const context = {
      currentUserId: "head",
      isAdmin: false,
      onMutated: () => setSubmitted(false),
    };
    return (
      <section aria-label="Report sections" tabIndex={-1}>
        <button type="button">Elsewhere</button>
        <ReportAccordionBody
          scope="lead"
          products={[]}
          leadGroups={
            submitted || !removeAuthor
              ? [{ id: "ada", name: "Ada Lovelace", products: [] }]
              : []
          }
          focusedProductId={undefined}
          scrollTargetProductId={undefined}
          focusedLeadId={undefined}
          overviewNavigationEpochs={new Map()}
          review={context}
          reviewModel={{
            context,
            groups: [],
            isHeadOrAdmin: true,
            sections: submitted
              ? [
                  {
                    reportSectionId: sectionId,
                    version: 1,
                    authorName: "Ada Lovelace",
                    status: "submitted",
                    reviews: [],
                    canReview: true,
                    groupId: null,
                  },
                ]
              : [],
          }}
          activitySections={[
            makeReportSectionFixture({
              reportSectionId: sectionId,
              authorId: "ada",
            }),
          ]}
        />
      </section>
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TRPCProxyContext.Provider value={proxy}>
        <Body />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
  return mutation;
}

async function requestChanges(preserveElsewhere = false) {
  const trigger = screen.getByRole("button", {
    name: "Request changes for Ada Lovelace",
  });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Reason for the lead" }),
    { target: { value: "Clarify the risk" } },
  );
  const submit = screen.getByRole("button", {
    name: "Request changes",
  });
  act(() => submit.focus());
  if (preserveElsewhere)
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
  fireEvent.click(submit);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
}

describe("inline verdict focus after unsubmit", () => {
  it("recovers lost dialog focus to the surviving author region", async () => {
    const mutation = setup(false);
    await requestChanges();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Ada L." })).toHaveFocus(),
    );
    expect(mutation.mutationFn).toHaveBeenCalledOnce();
    expect(mutation.mutationFn.mock.calls[0]?.[0]).toMatchObject({
      reportSectionId: sectionId,
      version: 1,
      verdict: "changes_requested",
      comment: "Clarify the risk",
    });
  });

  it("recovers to Sections when the submitted-only author disappears", async () => {
    setup(true);
    await requestChanges();
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Report sections" }),
      ).toHaveFocus(),
    );
  });

  it("does not steal focus that moved outside the verdict", async () => {
    setup(false);
    await requestChanges(true);
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });
});
