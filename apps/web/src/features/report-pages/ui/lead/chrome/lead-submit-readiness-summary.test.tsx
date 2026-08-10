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

    expect(screen.getByRole("status")).toHaveTextContent("Ready");
    await userEvent.click(
      screen.getByRole("button", { name: "Submit report" }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("lists auto-promotions without treating them as blockers", () => {
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

    expect(screen.getByText("Will be set to On Track")).toBeInTheDocument();
    expect(screen.getByText("Portal")).toBeInTheDocument();
    expect(screen.queryByText("Blocks submission")).toBeNull();
    expect(screen.getByText(/waiting to save/i)).toBeInTheDocument();
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

    expect(screen.getByRole("status")).toHaveTextContent("Needs attention");
    expect(screen.getByText("Blocks submission")).toBeInTheDocument();
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
});
