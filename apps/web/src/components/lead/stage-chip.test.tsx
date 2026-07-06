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

import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { StageChip } from "./stage-chip";

// StageChip now reveals its tooltip through the shared Radix Tooltip, which
// requires a TooltipProvider ancestor (SdlcPipeline mounts one in the app).
// Wrap every isolated chip render in the provider so the Radix Root resolves.
function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: TooltipProvider });
}

const BASE_LOCKED = {
  stageName: "DevOps",
  ownership: "locked" as const,
  assignee: "Boris",
};

describe("StageChip — locked stage color (F2)", () => {
  it("locked + empty → chip labelled with empty status", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "empty" }} />);
    expect(
      screen.getByRole("button", { name: "DevOps: empty" }),
    ).toBeInTheDocument();
    // empty surface token, not a flat gray override
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-surface-empty)",
    );
  });

  it("locked + at-risk → chip labelled with at-risk status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "at-risk" }} />);
    expect(
      screen.getByRole("button", { name: "DevOps: at-risk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-at-risk-bg)",
    );
  });

  it("locked + blocked → chip labelled with blocked status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "blocked" }} />);
    expect(
      screen.getByRole("button", { name: "DevOps: blocked" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-blocked-bg)",
    );
  });

  it("locked + on-track → chip labelled with on-track status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    expect(
      screen.getByRole("button", { name: "DevOps: on-track" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button").style.background).toBe(
      "var(--color-chip-on-track-bg)",
    );
  });

  it("locked chip renders the lock icon (aria-hidden svg)", () => {
    const { container } = render(
      <StageChip stage={{ ...BASE_LOCKED, status: "at-risk" }} />,
    );
    // lucide Lock renders as <svg aria-hidden="true">
    expect(container.querySelector("svg[aria-hidden]")).toBeInTheDocument();
  });

  it("locked chip is not editable — a click never fires onStatusChange", () => {
    const onStatusChange = vi.fn();
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "at-risk" }}
        onStatusChange={onStatusChange}
      />,
    );
    screen.getByRole("button").click();
    expect(onStatusChange).not.toHaveBeenCalled();
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

  it("chip button floors at the touch target below md (responsive-compact-layout)", () => {
    // jsdom cannot evaluate media queries; the class assertion is the teeth.
    // min-height beats the 36px inline height below `md`, so the chip grows to
    // the touch floor on phones while desktop keeps the aligned 36px box.
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
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

  it("a mine on-track chip announces 'status set' in its aria-label", () => {
    // simplify-stage-status-interaction: on-track is the only severity a lead
    // sets explicitly on the chip, so it is the only one that reads "status set".
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track" }}
        rawStatus="on-track"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: on-track — status set" }),
    ).toBeInTheDocument();
  });

  it("a mine blocked chip always reads 'by risk', never 'status set'", () => {
    // at-risk/blocked come only from risks now — a mine chip showing blocked is
    // risk-floored regardless of its raw status, so it announces "by risk".
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: blocked by risk" }),
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

  it("covered-empty and raw-set blocked chips share the 'by risk' label but differ visually", () => {
    // simplify-stage-status-interaction: both announce "by risk" now (blocked
    // comes only from risks), but the covered-empty chip stays a dashed sketch
    // (data-coverage="risk") while a raw-set chip renders solid — the W11 border
    // distinction survives even though the aria-label no longer splits them.
    const { unmount } = render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    const coveredButton = screen.getByRole("button");
    const coveredLabel = coveredButton.getAttribute("aria-label");
    const coveredCoverage = coveredButton.dataset.coverage;
    unmount();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    const setButton = screen.getByRole("button");
    expect(coveredLabel).toBe(setButton.getAttribute("aria-label"));
    expect(coveredLabel).toBe("Design: blocked by risk");
    expect(coveredCoverage).toBe("risk");
    expect(setButton.dataset.coverage).not.toBe("risk");
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

  it("covered chip with an explicit tooltip still surfaces 'by risk' on focus", async () => {
    // A pre-set tooltip must NOT swallow the coverage cue: a sighted hover
    // user gets the dashed border AND the "by risk" explanation, now revealed
    // through the shared Radix tooltip (opened here via keyboard focus).
    render(
      <StageChip
        stage={{
          ...BASE_MINE,
          status: "blocked",
          coveredByOwnRisk: true,
          tooltip: "Design · custom note",
        }}
        rawStatus="empty"
      />,
    );
    fireEvent.focus(screen.getByRole("button"));
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Design · custom note by risk");
  });
});

// ---- assignee-label invariants for the two live ownership states ----
// `StageOwnership` narrowed to "mine" | "locked" (feat 9f2018fd excludes
// unassigned stages from the pipeline before they reach a chip), so the old
// "unassigned" StageChip cases are gone; mine/locked label invariants stay.

describe("StageChip — assignee label invariants (mine/locked)", () => {
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
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    expect(screen.getByText("Boris")).toBeInTheDocument();
  });
});

// ---- simplify-stage-status-interaction (D1): the chip is a plain toggle ----
// An editable, uncovered chip toggles empty <-> on-track off the RAW status.
// There is NO status menu — at-risk/blocked are authored only via the Risks
// section, so a click never opens a popover or offers a severity option.

describe("StageChip — On Track / unset toggle (no menu)", () => {
  it("clicking an empty chip toggles it to on-track", () => {
    const onStatusChange = vi.fn();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "empty" }}
        rawStatus="empty"
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onStatusChange).toHaveBeenCalledWith("Design", "on-track");
  });

  it("clicking an on-track chip toggles it back to empty", () => {
    const onStatusChange = vi.fn();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track" }}
        rawStatus="on-track"
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onStatusChange).toHaveBeenCalledWith("Design", "empty");
  });

  it("opens no status menu and offers no at-risk/blocked option on click", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track" }}
        rawStatus="on-track"
        onStatusChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(screen.queryByText("! At Risk")).not.toBeInTheDocument();
    expect(screen.queryByText("✕ Blocked")).not.toBeInTheDocument();
  });

  it("a risk-floored chip fires the toggle intent (the bridge owns the hint)", () => {
    // The chip stays dumb: it toggles off the RAW status and lets the sync
    // bridge decide a covered chip is a no-op. Here raw is empty, so the
    // intent is on-track; the bridge (not the chip) blocks it when covered.
    const onStatusChange = vi.fn();
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onStatusChange).toHaveBeenCalledWith("Design", "on-track");
  });
});
