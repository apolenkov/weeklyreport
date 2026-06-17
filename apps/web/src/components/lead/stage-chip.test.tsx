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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
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

// ---- W11 (fix-report-surface-integrity 3.9): risk-covered vs status-set ----
// A stage whose displayed severity comes purely from the lead's OWN risk
// floor on a raw-empty status must read "by risk" and look distinct from a
// stage the lead explicitly set. A foreign-floored chip (no own coverage)
// must read neither — it just announces the floored status.

const BASE_MINE = {
  stageName: "Design",
  ownership: "mine" as const,
  assignee: "Me",
};

describe("StageChip — covered-by-risk vs status-set distinction (W11 3.9)", () => {
  it("covered-empty blocked chip announces 'by risk' in its aria-label", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: blocked by risk" }),
    ).toBeInTheDocument();
  });

  it("explicitly-set blocked chip announces 'status set' in its aria-label", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: blocked — status set" }),
    ).toBeInTheDocument();
  });

  it("covered-empty at-risk chip announces 'by risk'", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "at-risk", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: at-risk by risk" }),
    ).toBeInTheDocument();
  });

  it("covered-empty and explicitly-set blocked chips have DIFFERENT aria-labels", () => {
    const { unmount } = render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    const coveredLabel = screen.getByRole("button").getAttribute("aria-label");
    unmount();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    const setLabel = screen.getByRole("button").getAttribute("aria-label");
    expect(coveredLabel).not.toBe(setLabel);
    // both still announce the blocked severity
    expect(coveredLabel).toContain("blocked");
    expect(setLabel).toContain("blocked");
  });

  it("covered-empty and explicitly-set chips are visually distinguishable", () => {
    const { unmount } = render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    const coveredCoverage = screen
      .getByRole("button")
      .getAttribute("data-coverage");
    unmount();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    const setCoverage = screen
      .getByRole("button")
      .getAttribute("data-coverage");
    expect(coveredCoverage).toBe("risk");
    expect(setCoverage).not.toBe("risk");
  });

  it("foreign-floored raw-empty chip reads neither 'by risk' nor 'status set'", () => {
    // Display floor from a FOREIGN risk: floored to blocked, raw empty, but
    // NOT covered by the lead's own risk. Must not claim ownership of intent.
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: false }}
        rawStatus="empty"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: blocked" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").getAttribute("data-coverage")).not.toBe(
      "risk",
    );
  });

  it("locked chip keeps a plain status aria-label (no suffix)", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    expect(
      screen.getByRole("button", { name: "DevOps: blocked" }),
    ).toBeInTheDocument();
  });

  it("covered chip with an explicit tooltip still surfaces 'by risk' on focus", () => {
    // A pre-set tooltip must NOT swallow the coverage cue: a sighted hover
    // user gets the dashed border AND the "by risk" explanation.
    render(
      <SdlcTooltipProvider>
        <StageChip
          stage={{
            ...BASE_MINE,
            status: "blocked",
            coveredByOwnRisk: true,
            tooltip: "Design · custom note",
          }}
          rawStatus="empty"
        />
      </SdlcTooltipProvider>,
    );
    fireEvent.focus(screen.getByRole("button"));
    const tip = screen.getByTestId("sdlc-tooltip");
    expect(tip).toHaveTextContent("Design · custom note by risk");
  });
});

// ---- realistic-small-demo-seed: unassigned chip (D4 quiet/neutral copy) ----
// An unowned stage (ownership === "unassigned") must render muted and neutral:
// no "Contact admin" action-prompt, no error framing, still in the pipeline.
// mine and locked paths must be unaffected.

const BASE_UNASSIGNED = {
  stageName: "Planning",
  ownership: "unassigned" as const,
  status: "empty" as const,
  assignee: null,
};

describe("StageChip — unassigned stage (D4 neutral copy)", () => {
  it("unassigned chip renders in the document (stays in the pipeline)", () => {
    render(<StageChip stage={BASE_UNASSIGNED} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("unassigned chip does not show 'Contact admin'", () => {
    render(
      <SdlcTooltipProvider>
        <StageChip stage={BASE_UNASSIGNED} />
      </SdlcTooltipProvider>,
    );
    fireEvent.focus(screen.getByRole("button"));
    expect(screen.queryByText(/Contact admin/i)).not.toBeInTheDocument();
  });

  it("unassigned chip assignee label does not contain 'unassigned' text", () => {
    const { container } = render(<StageChip stage={BASE_UNASSIGNED} />);
    const spans = Array.from(container.querySelectorAll("span"));
    spans.forEach((span) => {
      expect(span.textContent).not.toMatch(/unassigned/i);
    });
  });

  it("unassigned chip is not editable — no status popover on click", () => {
    render(<StageChip stage={BASE_UNASSIGNED} />);
    screen.getByRole("button").click();
    expect(screen.queryByText("✓ On Track")).not.toBeInTheDocument();
    expect(screen.queryByText("✕ Blocked")).not.toBeInTheDocument();
  });

  it("mine chip assignee label is unchanged", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track", assignee: "Me" }}
        readOnly
      />,
    );
    expect(screen.getByText("Me")).toBeInTheDocument();
  });

  it("locked chip assignee label is unchanged", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "on-track" }}
        crossAuthorInfo={{ itemCount: 0, riskCount: 0 }}
      />,
    );
    expect(screen.getByText("Boris")).toBeInTheDocument();
  });
});
