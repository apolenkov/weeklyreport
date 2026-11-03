import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DecisionRecordContent,
  ItemRecordContent,
  RiskRecordContent,
} from "./report-record-rows";

describe("read-only record rows", () => {
  it("keeps unresolved record text read-only without duplicating wrapper badges", () => {
    render(
      <ItemRecordContent
        item={{
          id: "paused-item",
          text: "Waiting work",
          status: "paused",
          stage: "",
          owner: "Ada",
          stageLead: "Ada",
          priorityRank: 1,
        }}
      />,
    );
    expect(screen.getByText("Waiting work")).toBeInTheDocument();
    expect(screen.queryByText("Priority 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("preserves progress, priority, commitment and resolution history", () => {
    render(
      <ItemRecordContent
        item={{
          id: "item",
          text: "Deliver",
          status: "paused",
          stage: "",
          owner: "Lead",
          stageLead: "Lead",
          priorityRank: 1,
          nextStepText: "Follow up",
          resolution: {
            kind: "wont_do",
            eventId: "resolution",
            reason: "Superseded",
            actorId: "lead",
            actorName: "Ada",
            occurredAt: "2026-10-20T10:15:00Z",
            previousState: {
              type: "current",
              workflowStatus: "in_progress",
              pausedReason: null,
              nextStepText: null,
              text: "Deliver",
            },
          },
          outcomeHistory: [
            {
              id: "planned",
              stableId: "stable",
              outcome: "plan_next",
              reason: null,
              actorId: "lead",
              actorName: "Ada",
              occurredAt: "2026-10-19T09:00:00Z",
              beforeState: {
                type: "current",
                workflowStatus: "in_progress",
                pausedReason: null,
                nextStepText: null,
                text: "Deliver",
              },
              afterState: {
                type: "next",
                workflowStatus: "planned",
                pausedReason: null,
                nextStepText: null,
                text: "Deliver",
              },
              reversesEventId: null,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Deliver")).toBeInTheDocument();
    expect(screen.getByText("Next commitment: Follow up")).toBeInTheDocument();
    expect(screen.getByText("Won't do: Superseded")).toBeInTheDocument();
    expect(
      screen.getByText(/Marked Won't do by Ada · 2026-10-20 10:15 UTC/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Planned next step by Ada/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retains full risk and decision text without authoring actions", () => {
    render(
      <>
        <RiskRecordContent
          risk={{
            id: "risk",
            badge: "",
            stage: "",
            owner: "Lead",
            severity: "blocked",
            text: "Problem",
            problem: "Problem",
            impact: "Delay",
            mitigation: "Escalate",
          }}
        />
        <DecisionRecordContent
          decision={{
            id: "decision",
            badge: "",
            owner: "Lead",
            text: "Proceed",
          }}
        />
      </>,
    );
    for (const text of ["Problem", "Delay", "Escalate", "Proceed"])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
