import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpenWorkRegister } from "./open-work-register";
import type { OpenWorkRegisterItem } from "./open-work-register-model";

function item(status: "paused" | "postponed"): OpenWorkRegisterItem {
  const stableId =
    status === "paused"
      ? "50000000-0000-4000-8000-000000000001"
      : "50000000-0000-4000-8000-000000000002";
  return {
    key: stableId,
    periodLabel: "Jul 6–12, 2026",
    automaticPauseReason: null,
    action:
      status === "paused"
        ? { kind: "resume", label: "Resume paused work" }
        : { kind: "replan", label: "Replan deferred work" },
    occurrence: {
      source: "published",
      reportId: "50000000-0000-4000-8000-000000000003",
      reportSectionId: "50000000-0000-4000-8000-000000000004",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
      periodEnd: new Date("2026-07-12T00:00:00.000Z"),
      parent: {
        kind: "product",
        id: "50000000-0000-4000-8000-000000000005",
        name: "Payments",
      },
      item: {
        id: "50000000-0000-4000-8000-000000000006",
        stableId,
        projectId: "50000000-0000-4000-8000-000000000005",
        activityId: null,
        type: status === "paused" ? "current" : "next",
        text: status === "paused" ? "Provider rollout" : "Invoice review",
        tag: "delivery",
        workflowStatus: status,
        carriedOver: false,
        pausedReason: status === "paused" ? "Waiting for legal" : null,
        stageNames: ["Development"],
      },
    },
  };
}

describe("OpenWorkRegister disabled actions (R64)", () => {
  it("keeps a disabled action readable instead of fading it with opacity", () => {
    render(
      <OpenWorkRegister
        query={{
          openItems: [item("postponed")],
          terminalItems: [],
          isLoading: false,
          isComplete: true,
          error: null,
          retry: vi.fn(),
        }}
        actionsDisabled
        disabledReason="Reopen the report to plan this work."
        onOpen={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /Replan deferred work/ });
    expect(button).toBeDisabled();
    expect(button.className).not.toContain("disabled:opacity");
    expect(button.className).toContain(
      "disabled:text-[var(--color-muted-foreground)]",
    );
  });
});

describe("OpenWorkRegister", () => {
  it("shows source provenance, pause/deferral reason, and explicit actions", () => {
    const onOpen = vi.fn<(item: OpenWorkRegisterItem) => void>();
    render(
      <OpenWorkRegister
        query={{
          openItems: [item("paused"), item("postponed")],
          terminalItems: [],
          isLoading: false,
          isComplete: true,
          error: null,
          retry: vi.fn(),
        }}
        actionsDisabled={false}
        disabledReason={null}
        onOpen={onOpen}
      />,
    );

    expect(screen.getAllByText(/Published · Jul 6–12, 2026/)).toHaveLength(2);
    expect(screen.getByText("Pause reason: Waiting for legal")).toBeVisible();
    expect(screen.getByText("Deferral reason was not recorded.")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Resume paused work: Provider rollout, Jul 6–12, 2026",
      }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0].action.kind).toBe("resume");
    expect(
      screen.getByRole("button", {
        name: "Replan deferred work: Invoice review, Jul 6–12, 2026",
      }),
    ).toBeEnabled();
  });

  it("keeps terminal history collapsed and requires an explicit reopen action", () => {
    const cancelled = item("paused");
    const terminal: OpenWorkRegisterItem = {
      ...cancelled,
      action: { kind: "reopen", label: "Reopen in this report" },
      occurrence: {
        ...cancelled.occurrence,
        item: {
          ...cancelled.occurrence.item,
          resolution: {
            kind: "wont_do",
            eventId: "50000000-0000-4000-8000-000000000010",
            reason: "Contract ended",
            actorId: "50000000-0000-4000-8000-000000000011",
            actorName: "Test Lead",
            occurredAt: "2026-07-12T12:00:00.000Z",
            previousState: {
              type: "current",
              workflowStatus: "paused",
              pausedReason: "Waiting for legal",
              nextStepText: null,
              text: null,
            },
          },
        },
      },
    };
    render(
      <OpenWorkRegister
        query={{
          openItems: [],
          terminalItems: [terminal],
          isLoading: false,
          isComplete: true,
          error: null,
          retry: vi.fn(),
        }}
        actionsDisabled={false}
        disabledReason={null}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Completed and cancelled work (1)")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Reopen in this report: Provider rollout, Jul 6–12, 2026",
      }),
    ).not.toBeVisible();
    fireEvent.click(screen.getByText("Completed and cancelled work (1)"));
    expect(
      screen.getByRole("button", {
        name: "Reopen in this report: Provider rollout, Jul 6–12, 2026",
      }),
    ).toBeEnabled();
    expect(
      screen.getByText("Cancellation reason: Contract ended"),
    ).toBeVisible();
  });

  it("presents automatically paused work with its system reason and a resume action", () => {
    const paused = item("paused");
    const automatic: OpenWorkRegisterItem = {
      ...paused,
      key: "50000000-0000-4000-8000-000000000020",
      automaticPauseReason: "Not scheduled for the new week",
      action: { kind: "resume", label: "Resume paused work" },
      occurrence: {
        ...paused.occurrence,
        item: {
          ...paused.occurrence.item,
          stableId: "50000000-0000-4000-8000-000000000020",
          type: "current",
          workflowStatus: "planned",
          pausedReason: null,
        },
      },
    };
    const onOpen = vi.fn<(item: OpenWorkRegisterItem) => void>();
    render(
      <OpenWorkRegister
        query={{
          openItems: [automatic],
          terminalItems: [],
          isLoading: false,
          isComplete: true,
          error: null,
          retry: vi.fn(),
        }}
        actionsDisabled={false}
        disabledReason={null}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/Paused · Published/)).toBeInTheDocument();
    expect(
      screen.getByText("Pause reason: Not scheduled for the new week"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Resume paused work: Provider rollout, Jul 6–12, 2026",
      }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0].action.kind).toBe("resume");
    // The projected row does not relabel the stored status.
    expect(onOpen.mock.calls[0]?.[0].occurrence.item.workflowStatus).toBe(
      "planned",
    );
  });
});

describe("OpenWorkRegister item titles (R56)", () => {
  it("puts the period in the card title so identical texts stay distinguishable", () => {
    render(
      <OpenWorkRegister
        query={{
          openItems: [item("paused")],
          terminalItems: [],
          isLoading: false,
          isComplete: true,
          error: null,
          retry: vi.fn(),
        }}
        actionsDisabled={false}
        disabledReason={null}
        onOpen={vi.fn()}
      />,
    );

    const title = screen.getByText(/Provider rollout/, { selector: "p" });
    expect(title).toHaveTextContent("Provider rollout · Jul 6–12, 2026");
  });
});
