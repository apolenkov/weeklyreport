import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyProductReport } from "../../../features/report-sections";
import { PrintProductSection } from "./print-product-section";

function makeReport(
  status: WeeklyProductReport["status"],
): WeeklyProductReport {
  return {
    id: `report-${status}`,
    authorIds: ["author-1"],
    initials: "AL",
    name: "Alex Lead",
    status,
    statusLabel: status,
    leads: "Alex Lead",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

describe("PrintProductSection — status label/color pins", () => {
  it.each([
    { status: "on-track", label: "On Track", color: "#006241" },
    { status: "at-risk", label: "At Risk", color: "#daa520" },
    { status: "blocked", label: "Blocked", color: "#c82014" },
  ] as const)(
    "renders '$label' with $color for status '$status'",
    ({ status, label, color }) => {
      render(<PrintProductSection report={makeReport(status)} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: color });
    },
  );
});

describe("PrintProductSection — needs-attention severity is not invented", () => {
  it("colors the attention callout by the projection's own severity, never defaulting", () => {
    const report: WeeklyProductReport = {
      ...makeReport("on-track"),
      needsAttention: "SLA breach risk",
      needsAttentionSeverity: "blocked",
    };
    render(<PrintProductSection report={report} />);
    const callout = screen.getByText("SLA breach risk");
    // Blocked severity must render blocked ink, not the milder at-risk color.
    expect(callout).toHaveStyle({ borderLeft: "3px solid #c82014" });
  });

  it("renders no attention callout when the projection carries no attention", () => {
    render(<PrintProductSection report={makeReport("on-track")} />);
    expect(screen.queryByText(/breach|attention/i)).not.toBeInTheDocument();
  });
});

describe("PrintProductSection — item outcome context", () => {
  it("prints current commitment and cancellation audit with actor and time", () => {
    const report: WeeklyProductReport = {
      ...makeReport("on-track"),
      currentWeek: [
        {
          id: "item-1",
          stageLead: "Build · AL",
          stage: "Build",
          owner: "AL",
          text: "Delivered API endpoints",
          status: "in-progress",
          nextStepText: "Validate production metrics",
        },
        {
          id: "item-2",
          stageLead: "Build · AL",
          stage: "Build",
          owner: "AL",
          text: "Migrate the legacy client",
          status: "planned",
          resolution: {
            kind: "wont_do",
            eventId: "10000000-0000-4000-8000-000000000101",
            reason: "The dependency was retired",
            actorId: "10000000-0000-4000-8000-000000000102",
            actorName: "Alex Lead",
            occurredAt: "2026-09-05T08:30:00.000Z",
            previousState: {
              type: "next",
              workflowStatus: "planned",
              pausedReason: null,
              nextStepText: null,
            },
          },
          outcomeHistory: [
            {
              id: "10000000-0000-4000-8000-000000000103",
              stableId: "10000000-0000-4000-8000-000000000104",
              outcome: "wont_do",
              reason: "The dependency was retired",
              actorId: "10000000-0000-4000-8000-000000000102",
              actorName: "Alex Lead",
              occurredAt: "2026-09-05T08:30:00.000Z",
              beforeState: {
                type: "next",
                workflowStatus: "planned",
                pausedReason: null,
                nextStepText: null,
              },
              afterState: {
                type: "next",
                workflowStatus: "planned",
                pausedReason: null,
                nextStepText: null,
              },
              reversesEventId: null,
            },
          ],
        },
      ],
    };

    render(<PrintProductSection report={report} />);

    expect(
      screen.getByText("Next commitment: Validate production metrics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Won't do: The dependency was retired"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Planned")).toBeNull();
    expect(
      screen.getByText(/Marked Won't do by Alex Lead.*2026-09-05 08:30 UTC/),
    ).toBeInTheDocument();
  });
});

describe("PrintProductSection — next workflow meaning", () => {
  it("prints Planned and Postponed labels without relying on color", () => {
    render(
      <PrintProductSection
        report={{
          ...makeReport("on-track"),
          nextWeek: [
            {
              id: "next-planned",
              stageLead: "Build · AL",
              stage: "Build",
              owner: "AL",
              text: "Prepare rollout",
              status: "planned",
            },
            {
              id: "next-postponed",
              stageLead: "Testing · AL",
              stage: "Testing",
              owner: "AL",
              text: "Defer migration",
              status: "postponed",
              priorityRank: 3,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Postponed")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
    const postponedRow = screen.getByText("Defer migration").closest("li");
    expect(postponedRow).toHaveTextContent("[Testing · AL]");
    expect(postponedRow).toHaveTextContent("P3");
    expect(postponedRow).toHaveTextContent("Postponed");
    expect(postponedRow).not.toHaveTextContent("Planned");
  });
});
