/**
 * @vitest-environment jsdom
 *
 * F2: locked stage chips must show the cross-author's real risk color,
 * not a flat gray "empty" regardless of status.
 *
 * We verify status via aria-label (encodes `${stageName}: ${status}`) and
 * the per-status background token (config.bg from STATUS_CONFIG). Since
 * apply-status-palette the chip face carries no status glyph — color +
 * aria-label/tooltip are the carriers — and var() inline styles pass
 * through jsdom unnormalised, so they are safe to assert.
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
    // empty surface token, not a flat gray override
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-surface-empty)",
    );
  });

  it("locked + at-risk → chip labelled with at-risk status and token", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "at-risk" }}
        crossAuthorInfo={{ itemCount: 2, riskCount: 1 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: at-risk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-at-risk-bg)",
    );
  });

  it("locked + blocked → chip labelled with blocked status and token", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "blocked" }}
        crossAuthorInfo={{ itemCount: 3, riskCount: 2 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: blocked" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-blocked-bg)",
    );
  });

  it("locked + on-track → chip labelled with on-track status and token", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "on-track" }}
        crossAuthorInfo={{ itemCount: 1, riskCount: 0 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: on-track" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-on-track-bg)",
    );
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

// ---- align-pipeline-arrows: chip height token parity (D1) ----
// Verifies the chip button carries STAGE_CHIP_BOX_HEIGHT as inline height,
// matching the arrow wrapper in sdlc-pipeline.tsx so both midlines align.

import { STAGE_CHIP_BOX_HEIGHT } from "./stage-chip-config";

describe("StageChip — chip box height token (align-pipeline-arrows D1)", () => {
  it("chip button inline height equals STAGE_CHIP_BOX_HEIGHT", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const button = screen.getByRole("button");
    expect(button.style.height).toBe(STAGE_CHIP_BOX_HEIGHT);
  });
});
