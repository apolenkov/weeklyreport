// @vitest-environment jsdom
// Locked chips expose the cross-author risk token through an aria-labelled
// static indicator; editable own chips remain buttons. The status glyph is
// decorative and mirrors the same status.
import "@testing-library/jest-dom/vitest";

import { TooltipProvider } from "@customreport/ui/components/ui/tooltip";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { StageChip } from "./stage-chip";

// StageChip reveals its tooltip through the shared Radix Tooltip, which
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

describe("StageChip — locked stage color", () => {
  it("locked + empty → chip labelled with no status", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "empty" }} />);
    expect(
      screen.getByRole("img", { name: /DevOps: No status/ }),
    ).toBeInTheDocument();
    // empty surface token, not a flat gray override
    expect(screen.getByRole("img").style.background).toBe(
      "var(--color-surface-empty)",
    );
  });

  it("locked + at-risk → chip labelled with at-risk status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "at-risk" }} />);
    expect(
      screen.getByRole("img", { name: /DevOps: At risk/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img").style.background).toBe(
      "var(--color-chip-at-risk-bg)",
    );
  });

  it("locked + blocked → chip labelled with blocked status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "blocked" }} />);
    expect(
      screen.getByRole("img", { name: /DevOps: Blocked/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img").style.background).toBe(
      "var(--color-chip-blocked-bg)",
    );
  });

  it("locked + on-track → chip labelled with on-track status and token", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    expect(
      screen.getByRole("img", { name: /DevOps: On track/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img").style.background).toBe(
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
    screen.getByRole("img").click();
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("locked chip is a static indicator, not a focusable button", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const indicator = screen.getByRole("img");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(indicator).not.toHaveAttribute("tabindex");
    expect(indicator).not.toHaveAttribute("aria-disabled");
    expect(indicator).toHaveAccessibleName(
      "DevOps: On track — locked; owned by Boris. You don't have edit permissions",
    );
  });
});

// Chip height must match the arrow wrapper in sdlc-pipeline.tsx so midlines align.

describe("StageChip — chip box height token", () => {
  it("chip inline height is 36px", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const indicator = screen.getByRole("img");
    expect(indicator.style.height).toBe("36px");
  });

  it("chip floors at the touch target below lg", () => {
    // jsdom cannot evaluate media queries; the class assertion is the teeth.
    // min-height beats the 36px inline height below `lg`, so phones and tablets
    // keep the touch floor while desktop keeps the aligned 36px box.
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const indicator = screen.getByRole("img");
    expect(indicator.className).toContain(
      "max-lg:min-h-[var(--touch-target-min)]",
    );
  });
});

describe("StageChip — stretched row status visualization", () => {
  it("uses the compact display label for Development without changing its accessible name", () => {
    render(
      <StageChip
        stage={{
          stageName: "Development",
          ownership: "locked",
          assignee: "Boris",
          status: "on-track",
        }}
      />,
    );
    expect(
      screen.getByRole("img", { name: /Development: On track/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dev")).toHaveClass("lg:hidden");
    expect(screen.getByText("Development")).toHaveClass("hidden", "lg:inline");
  });

  it("keeps the status glyph derived from the displayed status", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "blocked" }} />);
    const glyph = screen.getByTestId("stage-status-glyph");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph).toHaveAttribute("data-status", "blocked");
    expect(glyph).toHaveTextContent("✕");
  });

  it("uses a full-width, left-aligned indicator with a truncation-safe label", () => {
    render(<StageChip stage={{ ...BASE_LOCKED, status: "on-track" }} />);
    const indicator = screen.getByRole("img");
    expect(indicator.className).toContain("w-full");
    expect(indicator.className).toContain("justify-start");
    expect(indicator.className).toContain("text-left");
    expect(indicator.querySelector("span span")?.className).toContain(
      "truncate",
    );
  });

  it("keeps a visible focus treatment for keyboard users", () => {
    render(<StageChip stage={{ ...BASE_MINE, status: "on-track" }} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("focus-visible:outline-none");
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-offset-1");
  });
});

// Own-risk floor on raw-empty must read "by risk" and look distinct from
// an explicit set; foreign-floored chips announce floored status only.

const BASE_MINE = {
  stageName: "Design",
  ownership: "mine" as const,
  assignee: "Me",
};

describe("StageChip — covered-by-risk vs status-set distinction", () => {
  it("covered-empty blocked chip announces 'by risk' in its aria-label", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "blocked", coveredByOwnRisk: true }}
        rawStatus="empty"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: Blocked by risk" }),
    ).toBeInTheDocument();
  });

  it("a mine on-track chip announces 'status set' in its aria-label", () => {
    // On-track is the only severity a lead sets on the chip — only it reads "status set".
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track" }}
        rawStatus="on-track"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Design: On track — status set" }),
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
      screen.getByRole("button", { name: "Design: Blocked by risk" }),
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
      screen.getByRole("button", { name: "Design: At risk by risk" }),
    ).toBeInTheDocument();
  });

  it("covered-empty and raw-set blocked chips share the 'by risk' label but differ visually", () => {
    // Both announce "by risk"; covered-empty is dashed (data-coverage=risk), raw-set solid.
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
    expect(coveredLabel).toBe("Design: Blocked by risk");
    expect(coveredCoverage).toBe("risk");
    expect(setButton.dataset.coverage).not.toBe("risk");
  });

  it("locked chip accessible name includes its non-editable reason", () => {
    render(
      <StageChip
        stage={{ ...BASE_LOCKED, status: "blocked" }}
        rawStatus="blocked"
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "DevOps: Blocked — locked; owned by Boris. You don't have edit permissions",
    );
  });

  it("read-only mine chip is static and explains the read-only state", () => {
    render(
      <StageChip
        stage={{ ...BASE_MINE, status: "on-track" }}
        readOnly
        onStatusChange={vi.fn()}
      />,
    );
    const indicator = screen.getByRole("img");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(indicator).not.toHaveAttribute("tabindex");
    expect(indicator).toHaveAccessibleName(
      "Design: On track — status set — read-only status view",
    );
  });

  it("covered chip with an explicit tooltip still surfaces 'by risk' on focus", async () => {
    // A pre-set tooltip must NOT swallow the coverage cue: a sighted hover
    // user gets the dashed border AND the "by risk" explanation, now revealed
    // receives both the dashed border and the "by risk" explanation.
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

// Pipeline drops unassigned stages before chips; only mine/locked labels remain.

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

  it("truncates long assignee labels to one line", () => {
    render(
      <StageChip
        stage={{
          ...BASE_LOCKED,
          status: "on-track",
          assignee: "A very long assignee name",
        }}
      />,
    );
    const assignee = screen.getByText("A very long assignee name");
    expect(assignee.className).toContain("truncate");
    expect(assignee).toHaveAttribute("title", "A very long assignee name");
  });
});

// Editable uncovered chips toggle empty ↔ on-track; at-risk/blocked live in Risks only.

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
