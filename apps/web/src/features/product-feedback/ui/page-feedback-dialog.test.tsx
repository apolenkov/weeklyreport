// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitPageFeedback } from "../model/page-feedback-client";
import { PageFeedbackDialog } from "./page-feedback-dialog";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("../model/page-feedback-client", () => ({
  submitPageFeedback: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const submit = vi.mocked(submitPageFeedback);
const identity = { name: "Lead User", email: "lead@example.test" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PageFeedbackDialog", () => {
  it("submits a supported type and bounded message, then restores focus", async () => {
    submit.mockResolvedValue(
      {} as Awaited<ReturnType<typeof submitPageFeedback>>,
    );
    const user = userEvent.setup();
    render(<PageFeedbackDialog identity={identity} />);

    const trigger = screen.getByRole("button", { name: "Comment on page" });
    await user.click(trigger);
    await user.selectOptions(screen.getByLabelText("Type"), "bug");
    await user.type(screen.getByLabelText("Comment"), "The page feels busy");
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        { type: "bug", message: "The page feels busy" },
        identity,
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("Page feedback sent.");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the dialog open with an actionable error after a failed request", async () => {
    submit.mockRejectedValue(new Error("network failed"));
    const user = userEvent.setup();
    render(<PageFeedbackDialog identity={identity} />);

    await user.click(screen.getByRole("button", { name: "Comment on page" }));
    const send = screen.getByRole("button", { name: "Send feedback" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Comment"), "Page comment");
    await user.click(send);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Page feedback could not be sent. Please try again.",
    );
    expect(
      screen.getByRole("dialog", { name: "Comment on page" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<PageFeedbackDialog identity={identity} />);

    const trigger = screen.getByRole("button", { name: "Comment on page" });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Comment on page" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Comment on page" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
