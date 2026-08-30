import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LeadSubmitReadiness } from "../../../../report-sections";
import { LeadSubmitReadinessSummary } from "./lead-submit-readiness-summary";

const ready: LeadSubmitReadiness = {
  unsetStatuses: [],
  willAutoPromote: [],
  blockingIssues: [],
  autosaveState: "saved",
  submitPending: false,
  canOpenConfirmation: true,
};

describe("LeadSubmitReadinessSummary", () => {
  it("announces ready state and invokes the shared submit handler", async () => {
    const onSubmit = vi.fn();
    render(
      <LeadSubmitReadinessSummary readiness={ready} onSubmit={onSubmit} />,
    );

    expect(
      screen.getByRole("heading", { name: "Before you submit" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Submit readiness")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This report is ready to submit.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit report" }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("keeps the submit action at the mobile touch-target floor", () => {
    render(<LeadSubmitReadinessSummary readiness={ready} onSubmit={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Submit report" });
    expect(submit.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
    expect(submit.className).toContain(
      "max-md:min-w-[var(--touch-target-min)]",
    );
    // The existing compact desktop floor remains unconditional; only the
    // mobile minimum is responsive.
    expect(submit.className).toContain("min-h-10");
  });

  it("summarizes auto-promotions in a closed inspectable disclosure", async () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          unsetStatuses: [
            { id: "product:p1", kind: "product", label: "Portal" },
          ],
          willAutoPromote: [
            { id: "product:p1", kind: "product", label: "Portal" },
          ],
          autosaveState: "pending",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText("1 unset status will be set to On Track."),
    ).toBeInTheDocument();
    const disclosure = screen.getByTestId("lead-submit-automatic-statuses");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Products (1)")).toBeInTheDocument();
    expect(screen.getByText("Portal")).toBeInTheDocument();
    expect(screen.queryByText("Fix before submitting")).toBeNull();
    expect(screen.getByText(/waiting to save/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText("When you submit:"));
    expect(disclosure).toHaveAttribute("open");
  });

  it("names blockers and disables the final submit action", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          blockingIssues: [
            {
              id: "risk-stage:p1",
              label: "Portal: specify stages for committed risks.",
            },
          ],
          canOpenConfirmation: false,
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Complete the items below before submitting.",
    );
    expect(screen.getByText("Fix before submitting")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit report" }),
    ).toBeDisabled();
  });

  it("explains when the current draft payload is unavailable", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          blockingIssues: [
            {
              id: "missing-draft",
              label: "The report draft is not available.",
            },
          ],
          canOpenConfirmation: false,
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText("The report draft is not available."),
    ).toBeInTheDocument();
  });

  it("announces an in-progress submission instead of claiming readiness", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          submitPending: true,
          canOpenConfirmation: false,
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Submitting report…");
    expect(
      screen.getByRole("button", { name: "Submit report" }),
    ).toBeDisabled();
  });
});
