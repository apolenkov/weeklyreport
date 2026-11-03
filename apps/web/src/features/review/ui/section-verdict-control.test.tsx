vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: (...args: unknown[]) => invalidateReviewMock(...args),
}));
// @vitest-environment jsdom
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
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { resolveBadge, SectionVerdictControl } from "./section-verdict-control";
import {
  invalidateReviewMock,
  renderControl,
  REPORT_SECTION_ID,
  review,
  toastError,
  toastSuccess,
  VERSION,
} from "./section-verdict-control.test-support";
describe("resolveBadge — 1", () => {
  it("filters stale verdicts into the awaiting state", () => {
    expect(resolveBadge([review("changes_requested", false)])).toEqual({
      kind: "awaiting",
      label: "Awaiting review",
    });
  });
});
describe("resolveBadge — 2", () => {
  it("ranks current changes requested above current approval", () => {
    expect(
      resolveBadge([
        review("approved", true),
        review("changes_requested", true),
      ]),
    ).toEqual({ kind: "changes", label: "Changes requested" });
  });
});
describe("resolveBadge — 3", () => {
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
describe("SectionVerdictControl — verdict buttons — 4", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
  });
  it("dismisses a reason dialog when capability is lost without reopening it on recovery", () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["review", "verdict"], mutation: true },
    ]);
    const client = new QueryClient();
    const tree = (canReview: boolean) => (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          <SectionVerdictControl
            reportSectionId="aaaaaaaa-1111-4111-8111-111111111111"
            version={1}
            reviews={[]}
            canReview={canReview}
            subjectName="Ada Lovelace"
            onMutated={vi.fn()}
          />
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    fireEvent.click(
      screen.getByRole("button", { name: "Request changes for Ada Lovelace" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(tree(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(tree(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(captured["review.verdict"]?.mutationFn).not.toHaveBeenCalled();
  });
});
describe("SectionVerdictControl — verdict buttons — 5", () => {
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
});
describe("SectionVerdictControl — verdict buttons — 6", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 7", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 8", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 9", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
  });
  it("reports a stale-version rejection without stamping a successful verdict", async () => {
    const { captured, onMutated } = renderControl({ canReview: true });
    const mutation = expectDefined(captured["review.verdict"]).mutationFn;
    mutation.mockRejectedValue(
      new Error("Section changed. Refresh and review the latest version."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Section changed. Refresh and review the latest version.",
      ),
    );
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0]?.[0]).toEqual({
      reportSectionId: REPORT_SECTION_ID,
      verdict: "approved",
      version: VERSION,
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onMutated).not.toHaveBeenCalled();
    expect(invalidateReviewMock).not.toHaveBeenCalled();
  });
});
describe("SectionVerdictControl — verdict buttons — 10", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 11", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
