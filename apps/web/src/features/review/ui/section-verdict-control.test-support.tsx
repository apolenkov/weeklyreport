// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type SectionReviewView } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();

const invalidateReviewMock = vi.fn<(...args: unknown[]) => void>();

import { SectionVerdictControl } from "./section-verdict-control";

const REPORT_SECTION_ID = "11111111-1111-4111-8111-111111111111";
const VERSION = 1;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderControl(options: {
  readonly canReview: boolean;
  readonly subjectName?: string;
  readonly onMutated?: () => void;
}) {
  const onMutated = options.onMutated ?? vi.fn<() => void>();
  const { proxy, captured } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={makeQueryClient()}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(
    <SectionVerdictControl
      reportSectionId={REPORT_SECTION_ID}
      version={VERSION}
      reviews={[]}
      canReview={options.canReview}
      subjectName={options.subjectName}
      onMutated={onMutated}
    />,
    { wrapper: Wrapper },
  );

  return { captured, onMutated };
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
export {
  invalidateReviewMock,
  renderControl,
  REPORT_SECTION_ID,
  review,
  toastError,
  toastSuccess,
  VERSION,
};

async function requestChanges() {
  await userEvent.click(
    screen.getByRole("button", { name: "Request changes" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  await userEvent.type(
    dialog.getByLabelText("Reason for the lead"),
    "Add the missing risk owner.",
  );
  await userEvent.click(
    dialog.getByRole("button", { name: "Request changes" }),
  );
}
export { requestChanges };
