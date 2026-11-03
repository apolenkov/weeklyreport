import { vi } from "vitest";
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

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  reviewVerdictInputSchema,
  type ReviewVerdictResult,
  reviewVerdictResultSchema,
} from "@weeklyreport/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  invalidateReviewMock,
  renderControl,
  REPORT_SECTION_ID,
  requestChanges,
  toastError,
  toastSuccess,
  VERSION,
} from "./section-verdict-control.test-support";
describe("SectionVerdictControl — verdict buttons — 1", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 2", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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

    // An independent dialog mutation must not leave a second verdict writer
    // armed behind the modal.
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveTextContent("Approve");
    expect(requestChanges).toHaveAttribute("aria-disabled", "true");
    await user.click(approve);
    expect(mutationFn).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(approve).toHaveAttribute("aria-disabled", "false");
    expect(requestChanges).toHaveAttribute("aria-disabled", "false");
  });
});
describe("SectionVerdictControl — verdict buttons — 3", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 4", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
describe("SectionVerdictControl — verdict buttons — 5", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
describe("SectionVerdictControl — verdict buttons — 6", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
