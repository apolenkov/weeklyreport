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

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  invalidateReviewMock,
  renderControl,
  toastError,
  toastSuccess,
} from "./section-verdict-control.test-support";
describe("SectionVerdictControl — verdict buttons — 12", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    invalidateReviewMock.mockClear();
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
});
