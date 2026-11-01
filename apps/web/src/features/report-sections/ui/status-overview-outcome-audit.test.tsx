import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { ItemOutcomeEvent } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { OutcomeAudit } from "./status-overview-outcome-audit";

const RESOLUTION_EVENT_ID = "00000000-0000-4000-8000-000000000002";

const state = {
  type: "current",
  workflowStatus: "in_progress",
  pausedReason: null,
  nextStepText: null,
  text: "Retire the legacy export",
} as const;

const resolution = {
  kind: "wont_do",
  eventId: RESOLUTION_EVENT_ID,
  reason: "Replaced by the new export",
  actorId: "00000000-0000-4000-8000-000000000003",
  actorName: "Lead Two",
  occurredAt: "2026-10-20T10:15:00Z",
  previousState: state,
} as const;

function event(id: string, outcome: "plan_next" | "wont_do"): ItemOutcomeEvent {
  return {
    id,
    stableId: "00000000-0000-4000-8000-000000000005",
    outcome,
    reason: null,
    actorId: "00000000-0000-4000-8000-000000000006",
    actorName: "Lead One",
    occurredAt: "2026-10-19T09:00:00Z",
    beforeState: state,
    afterState: state,
  } as unknown as ItemOutcomeEvent;
}

function auditItem(
  outcomeHistory: readonly ItemOutcomeEvent[],
): StatusOverviewItem {
  return {
    key: "current:stable-1",
    recordId: "item-1",
    stableId: "stable-1",
    source: "current",
    editTarget: { recordId: "item-1", source: "current" },
    text: "Retire the legacy export",
    tag: "delivery",
    stageNames: [],
    pausedReason: null,
    resolution,
    outcomeHistory,
    comments: [],
    canResolve: false,
    canRestore: true,
    workflowStatus: "in_progress",
    continuity: null,
  } as unknown as StatusOverviewItem;
}

describe("OutcomeAudit", () => {
  it("keeps the Won't do actor and time when the history omits the resolution event", () => {
    render(
      <OutcomeAudit
        item={auditItem([
          event("00000000-0000-4000-8000-000000000004", "plan_next"),
        ])}
      />,
    );

    expect(
      screen.getByText(/Moved to next week by Lead One/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Marked Won't do by Lead Two · 2026-10-20 10:15 UTC/),
    ).toBeInTheDocument();
  });

  it("does not repeat the resolution when the history already lists its event", () => {
    render(
      <OutcomeAudit
        item={auditItem([event(RESOLUTION_EVENT_ID, "wont_do")])}
      />,
    );

    expect(screen.getAllByText(/Marked Won't do by/)).toHaveLength(1);
    expect(screen.getByText(/Marked Won't do by Lead One/)).toBeInTheDocument();
  });

  it("shows the resolution alone when the history is empty", () => {
    render(<OutcomeAudit item={auditItem([])} />);

    expect(
      screen.getByText(/Marked Won't do by Lead Two · 2026-10-20 10:15 UTC/),
    ).toBeInTheDocument();
  });
});
