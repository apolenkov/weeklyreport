import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyReportRisk } from "../../../report-sections";
import { RiskRow } from "./accordion-rows";

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
