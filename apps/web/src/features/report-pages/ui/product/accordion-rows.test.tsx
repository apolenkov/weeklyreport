import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { ItemOutcomeEvent, ItemResolution } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import type {
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../report-sections";
import { RankMark } from "./accordion-row-primitives";
import { ItemRow, RiskRow } from "./accordion-rows";

const risk: WeeklyReportRisk = {
  id: "risk-1",
  badge: "blocked",
  stage: "Development",
  owner: "Lead One",
  severity: "blocked",
  text: "Auth is flaky — Impact: Users cannot log in — Mitigation: Fixing timeout",
  problem: "Auth is flaky",
  impact: "Users cannot log in",
  mitigation: "Fixing timeout",
};

describe("RankMark", () => {
  it("keeps the priority number readable on the gold marker", () => {
    render(<RankMark rank={1} />);

    const marker = screen.getByTitle("Priority 1");
    expect(marker).toHaveTextContent("1");
    expect(marker).toHaveStyle({
      background: "var(--color-starbucks-gold)",
      color: "var(--color-foreground)",
    });
  });
});

describe("RiskRow", () => {
  it("renders the problem inside a block container, not a span", () => {
    const { container } = render(<RiskRow risk={risk} />);

    // The problem text must not live inside a <span> that wraps block
    // children — block-in-span is invalid HTML the parser would break.
    const problem = screen.getByText("Auth is flaky");
    const problemParent = problem.parentElement;
    expect(problemParent).not.toBeNull();
    if (problemParent) {
      expect(problemParent.tagName).toBe("DIV");
    }
    expect(container.querySelector("span > div")).toBeNull();
  });

  it("renders impact and mitigation when present", () => {
    render(<RiskRow risk={risk} />);
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Users cannot log in")).toBeInTheDocument();
    expect(screen.getByText("Mitigation")).toBeInTheDocument();
    expect(screen.getByText("Fixing timeout")).toBeInTheDocument();
  });
});

describe("ItemRow", () => {
  it("keeps the Won't do actor and time when the outcome history omits the resolution event", () => {
    const item: WeeklyReportItem = {
      id: "item-1",
      stageLead: "Lead One",
      stage: "Development",
      owner: "Lead One",
      text: "Retire the legacy export",
      status: "in-progress",
      resolution: {
        kind: "wont_do",
        eventId: "00000000-0000-4000-8000-000000000002",
        reason: "Replaced by the new export",
        actorId: "00000000-0000-4000-8000-000000000003",
        actorName: "Lead Two",
        occurredAt: "2026-10-20T10:15:00Z",
        previousState: { status: "in-progress" },
      } as ItemResolution,
      outcomeHistory: [
        {
          id: "00000000-0000-4000-8000-000000000004",
          stableId: "00000000-0000-4000-8000-000000000005",
          outcome: "plan_next",
          reason: null,
          actorId: "00000000-0000-4000-8000-000000000006",
          actorName: "Lead One",
          occurredAt: "2026-10-19T09:00:00Z",
        } as ItemOutcomeEvent,
      ],
    };

    render(<ItemRow item={item} />);

    expect(
      screen.getByText(/Planned next step by Lead One/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Marked Won't do by Lead Two · 2026-10-20 10:15 UTC/),
    ).toBeInTheDocument();
  });
});
