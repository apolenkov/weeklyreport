// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { SectionReviewView } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const invalidateReviewMock = vi.fn<(...args: unknown[]) => void>();
vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: (...args: unknown[]) => invalidateReviewMock(...args),
}));

import { resolveBadge, SectionVerdictControl } from "./section-verdict-control";

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

describe("SectionVerdictControl — verdict buttons", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
  });

  it("hides Approve / Request changes when the viewer is not a designated reviewer", () => {
    renderControl({ canReview: false });
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request changes" }),
    ).not.toBeInTheDocument();
  });

  it("shows both verdict actions for a designated reviewer", () => {
    renderControl({ canReview: true });
    expect(screen.getByRole("button", { name: "Approve" })).toMatchObject({
      disabled: false,
    });
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute(
      "data-interaction-effect",
      "mutation-required",
    );
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toMatchObject({ disabled: false });
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toHaveAttribute("data-interaction-effect", "mutation-required");
  });

  it("Approve submits approved+version, toasts, invalidates review cache, and notifies parent", async () => {
    const { captured, onMutated } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    mutationFn.mockResolvedValue({
      unsubmitted: false,
      verdict: "approved",
      judgedVersion: VERSION,
    });

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });
    expect(mutationFn.mock.calls[0]?.[0]).toEqual({
      reportSectionId: REPORT_SECTION_ID,
      verdict: "approved",
      version: VERSION,
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Section approved");
    });
    expect(invalidateReviewMock).toHaveBeenCalledTimes(1);
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it("Request changes only opens the reason dialog and sends nothing", async () => {
    const { captured } = renderControl({ canReview: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Request changes" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      expectDefined(captured["review.verdict"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("Request changes with unsubmit toasts the lead-return message and invalidates", async () => {
    const { captured, onMutated } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    mutationFn.mockResolvedValue({
      unsubmitted: true,
      verdict: "changes_requested",
      judgedVersion: VERSION,
    });

    await requestChanges();

    await waitFor(() => {
      expect(mutationFn.mock.calls[0]?.[0]).toEqual({
        reportSectionId: REPORT_SECTION_ID,
        verdict: "changes_requested",
        version: VERSION,
        comment: "Add the missing risk owner.",
      });
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Changes requested — section returned to the lead",
      );
    });
    expect(invalidateReviewMock).toHaveBeenCalledTimes(1);
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it("Request changes without unsubmit toasts the plain changes message", async () => {
    const { captured } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    mutationFn.mockResolvedValue({
      unsubmitted: false,
      verdict: "changes_requested",
      judgedVersion: VERSION,
    });

    await requestChanges();

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Changes requested");
    });
  });
});
