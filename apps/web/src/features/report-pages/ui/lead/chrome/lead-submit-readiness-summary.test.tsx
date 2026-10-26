import { onlineManager } from "@tanstack/react-query";
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
  pendingReviewCount: 0,
  autosaveState: "saved",
  submitPending: false,
  canOpenConfirmation: true,
};

describe("LeadSubmitReadinessSummary", () => {
  it("visibly describes the disabled summary Submit beside the button", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          canOpenConfirmation: false,
          blockingIssues: [
            {
              id: "missing-draft",
              label: "The report draft is not available.",
            },
          ],
        }}
        onSubmit={vi.fn()}
        showSubmitAction
      />,
    );
    const submit = screen.getByRole("button", { name: "Submit report" });
    expect(submit).toHaveAccessibleDescription(
      "The report draft is not available.",
    );
    expect(submit.parentElement).toHaveTextContent(
      "The report draft is not available.",
    );
  });

  it("suppresses redundant save copy when the page owns the save indicator", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={ready}
        onSubmit={vi.fn()}
        showAutosaveStatus={false}
      />,
    );
    expect(screen.queryByText("Draft is saved.")).toBeNull();
  });
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

  it("explains the offline pause instead of claiming a save is in flight", () => {
    const saving: LeadSubmitReadiness = { ...ready, autosaveState: "saving" };
    onlineManager.setOnline(false);
    try {
      const { unmount } = render(
        <LeadSubmitReadinessSummary readiness={saving} onSubmit={vi.fn()} />,
      );
      expect(
        screen.getByText(/paused while you’re offline/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Draft changes are saving."),
      ).not.toBeInTheDocument();
      unmount();
    } finally {
      onlineManager.setOnline(true);
    }

    render(
      <LeadSubmitReadinessSummary readiness={saving} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("Draft changes are saving.")).toBeInTheDocument();
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

  it("announces the review counter while continuations are pending", () => {
    render(
      <LeadSubmitReadinessSummary
        readiness={{
          ...ready,
          pendingReviewCount: 2,
          blockingIssues: [
            {
              id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:a",
              label: 'Review "A".',
            },
            {
              id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:b",
              label: 'Review "B".',
            },
          ],
          canOpenConfirmation: false,
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 to review. Complete the items below before submitting.",
    );
  });

  it("links a carried-item blocker to its exact Overview progress control", async () => {
    const overviewFocus = "confirm:current:carried-item";
    render(
      <>
        <button
          id={overviewFocus}
          aria-label="Status of Carried work"
          data-overview-focus={overviewFocus}
        >
          Status
        </button>
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-item",
                label: 'Review "Carried work".',
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
      name: 'Review "Carried work".',
    });
    expect(link).toHaveAttribute("href", `#${overviewFocus}`);
    await userEvent.click(link);
    expect(
      screen.getByRole("button", { name: "Status of Carried work" }),
    ).toHaveFocus();
  });

  it("leaves modified completion-link activation to native navigation", () => {
    const overviewFocus = "confirm:current:carried-item";
    window.history.replaceState(null, "", "/lead/report/report-1");
    render(
      <>
        <button
          id={overviewFocus}
          aria-label="Status of Carried work"
          data-overview-focus={overviewFocus}
        >
          Status
        </button>
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-item",
                label: 'Review "Carried work".',
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
      name: "Status of Carried work",
    });
    const allowed = fireEvent.click(
      screen.getByRole("link", {
        name: 'Review "Carried work".',
      }),
      { metaKey: true },
    );

    expect(allowed).toBe(true);
    expect(target).not.toHaveFocus();
    expect(window.location.hash).toBe("");
  });

  it("expands a collapsed unit before focusing its exact carried progress control", async () => {
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
      resolution: null,
      outcomeHistory: [],
      comments: [],
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
        <StatusOverview
          model={model}
          onEditItem={vi.fn()}
          onSetStatus={vi.fn()}
        />
        <LeadSubmitReadinessSummary
          readiness={{
            ...ready,
            blockingIssues: [
              {
                id: "submit-validation:UNCONFIRMED_CARRIED_ITEM:carried-third",
                label: 'Review "Third carried work".',
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
    const progress = screen.getByRole("button", {
      name: "Status of Third carried work: Continued · not updated this week",
      hidden: true,
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(progress).not.toBeVisible();

    await userEvent.click(
      screen.getByRole("link", {
        name: 'Review "Third carried work".',
      }),
    );

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(progress).toBeVisible();
    expect(progress).toHaveFocus();
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
