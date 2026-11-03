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
describe("SectionVerdictControl — verdict buttons — 7", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
