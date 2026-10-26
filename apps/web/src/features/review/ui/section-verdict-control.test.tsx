// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  reviewVerdictInputSchema,
  type ReviewVerdictResult,
  reviewVerdictResultSchema,
  type SectionReviewView,
} from "@weeklyreport/shared";
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

  it("names the verdict buttons and the reason dialog after the section owner", async () => {
    renderControl({ canReview: true, subjectName: "Ada Lovelace" });

    expect(
      screen.getByRole("button", { name: "Approve Ada Lovelace" }),
    ).toHaveTextContent("Approve");
    await userEvent.click(
      screen.getByRole("button", { name: "Request changes for Ada Lovelace" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Request changes from Ada Lovelace" }),
    ).toBeInTheDocument();
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

  it("keeps focus on Approve while the verdict saves and ignores repeat clicks", async () => {
    const { captured } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    mutationFn.mockReturnValue(new Promise(() => undefined));

    const approve = screen.getByRole("button", { name: "Approve" });
    await userEvent.click(approve);

    await waitFor(() => {
      expect(approve).toHaveAttribute("aria-disabled", "true");
    });
    // A natively disabled button would drop focus to <body>.
    expect(document.activeElement).toBe(approve);
    await userEvent.click(approve);
    await userEvent.click(
      screen.getByRole("button", { name: "Request changes" }),
    );
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends one verdict when Approve is activated twice before the pending state renders", async () => {
    const { captured } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    mutationFn.mockReturnValue(new Promise(() => undefined));
    const approve = screen.getByRole("button", { name: "Approve" });

    act(() => {
      approve.click();
      approve.click();
    });

    await waitFor(() => {
      expect(approve).toHaveAttribute("aria-disabled", "true");
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it("renames Approve to match its Saving text while the verdict saves", async () => {
    const { captured } = renderControl({
      canReview: true,
      subjectName: "Ada Lovelace",
    });
    expectDefined(captured["review.verdict"]).mutationFn.mockReturnValue(
      new Promise(() => undefined),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Approve Ada Lovelace" }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Saving verdict for Ada Lovelace",
      }),
    ).toHaveTextContent("Saving…");
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

  it("keeps the background verdict actions inert while the reason dialog is open", async () => {
    const user = userEvent.setup();
    const { captured } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    const approve = screen.getByRole("button", { name: "Approve" });
    const requestChanges = screen.getByRole("button", {
      name: "Request changes",
    });

    await user.click(requestChanges);
    const dialog = within(screen.getByRole("dialog"));

    // TASK-503.40 / C5150: an independent dialog mutation must not leave a
    // second verdict writer armed behind the modal.
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveTextContent("Approve");
    expect(requestChanges).toHaveAttribute("aria-disabled", "true");
    await user.click(approve);
    expect(mutationFn).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(approve).toHaveAttribute("aria-disabled", "false");
    expect(requestChanges).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps Approve inert while the reason dialog mutation is pending", async () => {
    const user = userEvent.setup();
    const { captured } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    const response = Promise.withResolvers<ReviewVerdictResult>();
    mutationFn.mockReturnValue(response.promise);
    const approve = screen.getByRole("button", { name: "Approve" });

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(
      dialog.getByLabelText("Reason for the lead"),
      "Add the missing risk owner.",
    );
    await user.click(dialog.getByRole("button", { name: "Request changes" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    });

    expect(approve).toHaveAttribute("aria-disabled", "true");
    await user.click(approve);
    expect(mutationFn).toHaveBeenCalledTimes(1);

    response.resolve(
      reviewVerdictResultSchema.parse({
        verdict: "changes_requested",
        judgedVersion: VERSION,
        unsubmitted: true,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
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

  it("keeps keyboard activation inside the pending reason dialog and records one verdict", async () => {
    const user = userEvent.setup();
    const { captured, onMutated } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    const response = Promise.withResolvers<ReviewVerdictResult>();
    mutationFn.mockReturnValue(response.promise);

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("Reason for the lead");
    expect(field).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole("button", { name: "Request changes" }),
    ).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();
    await user.type(field, "Add the missing risk owner.");
    await user.click(
      within(dialog).getByRole("button", { name: "Request changes" }),
    );

    await waitFor(() => {
      expect(dialog).toHaveAttribute("aria-busy", "true");
    });
    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    await user.tab();
    expect(dialog).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab({ shift: true });
    expect(dialog).toHaveFocus();
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(
      reviewVerdictInputSchema.parse(mutationFn.mock.calls[0]?.[0]),
    ).toEqual({
      reportSectionId: REPORT_SECTION_ID,
      verdict: "changes_requested",
      version: VERSION,
      comment: "Add the missing risk owner.",
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onMutated).not.toHaveBeenCalled();

    response.resolve(
      reviewVerdictResultSchema.parse({
        verdict: "changes_requested",
        judgedVersion: VERSION,
        unsubmitted: true,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it("keeps a rejected request inline until Cancel, then records a subsequent approval", async () => {
    const user = userEvent.setup();
    const { captured, onMutated } = renderControl({ canReview: true });
    const mutationFn = expectDefined(captured["review.verdict"]).mutationFn;
    const response = Promise.withResolvers<ReviewVerdictResult>();
    mutationFn.mockReturnValueOnce(response.promise);
    mutationFn.mockResolvedValue(
      reviewVerdictResultSchema.parse({
        verdict: "approved",
        judgedVersion: VERSION,
        unsubmitted: false,
      }),
    );

    await requestChanges();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    });
    response.reject(new Error("Temporary service failure."));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Temporary service failure.",
    );
    expect(within(dialog).getByLabelText("Reason for the lead")).toHaveValue(
      "Add the missing risk owner.",
    );
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(onMutated).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Section approved");
    });
    expect(mutationFn).toHaveBeenCalledTimes(2);
    expect(
      reviewVerdictInputSchema.parse(mutationFn.mock.calls[1]?.[0]),
    ).toEqual({
      reportSectionId: REPORT_SECTION_ID,
      verdict: "approved",
      version: VERSION,
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(onMutated).toHaveBeenCalledTimes(1);
  });
});
