import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  type LeadSubmitReadiness,
  StatusOverview,
  type StatusOverviewModel,
} from "../../../../report-sections";
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
  it("announces ready state without duplicating the global submit action", () => {
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
    expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers Submit when the caller has no sticky completion path", async () => {
    const onSubmit = vi.fn();
    render(
      <LeadSubmitReadinessSummary
        readiness={ready}
        onSubmit={onSubmit}
        showSubmitAction
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Submit report" }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
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
      screen.getByText(
        "1 unset status will be marked On Track when submitted.",
      ),
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

  it("links risk-stage blockers to report details without adding another submit action", async () => {
    render(
      <>
        <div id="report-details" tabIndex={-1} />
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "risk-stage:p1",
                label: "Portal: specify stages for committed risks.",
                overviewFocus: "report-details",
              },
            ],
            canOpenConfirmation: false,
          }}
          onSubmit={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Complete the items below before submitting.",
    );
    expect(screen.getByText("Fix before submitting")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
    await userEvent.click(
      screen.getByRole("link", {
        name: "Portal: specify stages for committed risks.",
      }),
    );
    expect(document.getElementById("report-details")).toHaveFocus();
  });

  it("links a carried-item blocker to its exact Overview confirmation", async () => {
    const overviewFocus = "confirm:current:carried-item";
    render(
      <>
        <button data-overview-focus={overviewFocus}>
          Confirm for this week
        </button>
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-item",
                label: 'Confirm "Carried work" for this week.',
                overviewFocus,
              },
            ],
            canOpenConfirmation: false,
          }}
          onSubmit={vi.fn()}
        />
      </>,
    );

    const link = screen.getByRole("link", {
      name: 'Confirm "Carried work" for this week.',
    });
    expect(link).toHaveAttribute("href", `#${overviewFocus}`);
    await userEvent.click(link);
    expect(
      screen.getByRole("button", { name: "Confirm for this week" }),
    ).toHaveFocus();
  });

  it("leaves modified completion-link activation to native navigation", () => {
    const overviewFocus = "confirm:current:carried-item";
    window.history.replaceState(null, "", "/lead/report/report-1");
    render(
      <>
        <button data-overview-focus={overviewFocus}>
          Confirm for this week
        </button>
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-item",
                label: 'Confirm "Carried work" for this week.',
                overviewFocus,
              },
            ],
            canOpenConfirmation: false,
          }}
          onSubmit={vi.fn()}
        />
      </>,
    );

    const target = screen.getByRole("button", {
      name: "Confirm for this week",
    });
    const allowed = fireEvent.click(
      screen.getByRole("link", {
        name: 'Confirm "Carried work" for this week.',
      }),
      { metaKey: true },
    );

    expect(allowed).toBe(true);
    expect(target).not.toHaveFocus();
    expect(window.location.hash).toBe("");
  });

  it("expands a collapsed unit before focusing its exact carried confirmation", async () => {
    const overviewFocus = "confirm:current:carried-third";
    window.history.replaceState(null, "", "/lead/report/report-1");
    const currentItem = (index: number, stableId: string, text: string) => ({
      key: `current:${stableId}`,
      recordId: `record-${String(index)}`,
      source: "current" as const,
      editTarget: {
        recordId: `record-${String(index)}`,
        source: "current" as const,
      },
      stableId,
      text,
      tag: "delivery",
      stageNames: [],
      pausedReason: null,
      canResolve: true,
      canRestore: false,
      workflowStatus: "in_progress" as const,
      needsConfirmation: true,
      continuity: "continued" as const,
    });
    const model: StatusOverviewModel = {
      periods: {
        previouslyPlanned: "24–30 Aug 2026",
        currentWeek: "31 Aug–6 Sep 2026",
        nextWeek: "7–13 Sep 2026",
      },
      previousPlanSource: "published",
      sourceCounts: { previouslyPlanned: 0, currentWeek: 3, nextWeek: 0 },
      units: [
        {
          key: "product:portal",
          id: "portal",
          kind: "product",
          name: "Portal",
          historical: false,
          status: "on-track",
          stages: [],
          linkedProducts: [],
          columns: {
            previouslyPlanned: { availability: "available", items: [] },
            currentWeek: {
              availability: "available",
              items: [
                currentItem(1, "carried-first", "First carried work"),
                currentItem(2, "carried-second", "Second carried work"),
                currentItem(3, "carried-third", "Third carried work"),
              ],
            },
            nextWeek: { availability: "available", items: [] },
          },
        },
      ],
    };
    render(
      <>
        <StatusOverview model={model} onConfirmItem={vi.fn()} />
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-third",
                label: 'Confirm "Third carried work" for this week.',
                overviewFocus,
              },
            ],
            canOpenConfirmation: false,
          }}
          onSubmit={vi.fn()}
        />
      </>,
    );

    const disclosure = screen.getByRole("button", { name: "+1 more" });
    const confirm = screen.getByRole("button", {
      name: "Confirm Third carried work for this week",
      hidden: true,
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(confirm).not.toBeVisible();

    await userEvent.click(
      screen.getByRole("link", {
        name: 'Confirm "Third carried work" for this week.',
      }),
    );

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(confirm).toBeVisible();
    expect(confirm).toHaveFocus();
    expect(window.location.hash).toBe(`#${overviewFocus}`);
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
    expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
  });
});
