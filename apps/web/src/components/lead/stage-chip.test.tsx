/**
 * @vitest-environment jsdom
 *
 * F2: locked stage chips must show the cross-author's real risk color,
 * not a flat gray "empty" regardless of status.
 *
 * We verify status via aria-label (encodes `${stageName}: ${status}`) and
 * the visible icon character (config.icon from STATUS_CONFIG). Inline-style
 * hex assertions are avoided — jsdom normalises them to rgb().
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageChip } from "./stage-chip";

const BASE_LOCKED = {
  stageName: "DevOps",
  ownership: "locked" as const,
  assignee: "Boris",
};

describe("StageChip — locked stage color (F2)", () => {
  it("locked + empty → chip labelled with empty status", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "empty" }}
        crossAuthorInfo={{ itemCount: 0, riskCount: 0 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: empty" }),
    ).toBeInTheDocument();
    // empty icon
    expect(screen.getByRole("button").textContent).toContain("○");
  });

  it("locked + at-risk → chip labelled with at-risk status and ! icon", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "at-risk" }}
        crossAuthorInfo={{ itemCount: 2, riskCount: 1 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: at-risk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").textContent).toContain("!");
  });

  it("locked + blocked → chip labelled with blocked status and ✕ icon", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "blocked" }}
        crossAuthorInfo={{ itemCount: 3, riskCount: 2 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: blocked" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").textContent).toContain("✕");
  });

  it("locked + on-track → chip labelled with on-track status and ✓ icon", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "on-track" }}
        crossAuthorInfo={{ itemCount: 1, riskCount: 0 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: on-track" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").textContent).toContain("✓");
  });

  it("locked chip renders the lock icon (aria-hidden svg)", () => {
    const { container } = render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "at-risk" }}
        crossAuthorInfo={{ itemCount: 1, riskCount: 0 }}
      />,
    );
    // lucide Lock renders as <svg aria-hidden="true">
    expect(container.querySelector("svg[aria-hidden]")).toBeInTheDocument();
  });

  it("locked chip is not editable — no status popover on click", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "at-risk" }} />);
    screen.getByRole("button").click();
    expect(screen.queryByText("✓ On Track")).not.toBeInTheDocument();
    expect(screen.queryByText("✕ Blocked")).not.toBeInTheDocument();
  });
});
