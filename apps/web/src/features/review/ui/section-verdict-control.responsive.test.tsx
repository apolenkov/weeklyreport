// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { SectionVerdictControl } from "./section-verdict-control";

it("stacks the badge and wraps verdict actions on narrow screens", () => {
  const { proxy } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TRPCProxyContext.Provider value={proxy}>
        <SectionVerdictControl
          reportSectionId="section"
          version={1}
          reviews={[]}
          canReview
          onMutated={vi.fn()}
        />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
  const badge = screen.getByText("Not reviewed");
  const approve = screen.getByRole("button", { name: "Approve" });
  const request = screen.getByRole("button", { name: "Request changes" });
  expect(badge.parentElement).toHaveClass("flex-col", "sm:flex-row");
  expect(approve.parentElement).toHaveClass("flex-wrap");
  expect(approve.parentElement).toContainElement(request);
  expect(
    badge.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(approve).toHaveClass("max-md:min-h-[var(--touch-target-min)]");
  expect(request).toHaveClass("max-md:min-h-[var(--touch-target-min)]");
});
