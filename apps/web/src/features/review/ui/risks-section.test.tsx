// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/feedback/sdlc-tooltip";
import type { RiskEntry } from "../../report-sections";
import { RisksSection } from "./risks-section";

const baseRisk: RiskEntry = {
  id: "risk-1",
  productId: "product-1",
  productName: "CRM",
  severity: "at-risk",
  text: "Vendor delay",
  impact: "Delivery slips",
  mitigation: "Escalate",
  stageNames: ["Planning"],
};

const foreignRisk: RiskEntry = {
  id: "r1",
  productId: "p1",
  productName: "Product",
  severity: "at-risk",
  text: "x",
  impact: "i",
  mitigation: "m",
  foreign: true,
  authorName: "Alice",
  stageNames: ["Planning"],
};

describe("RisksSection LockBadge", () => {
  it("foreign risk card renders LockBadge in header, not Edit/Delete", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[foreignRisk]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.getByLabelText("Read-only — authored by Alice"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete risk/i }),
    ).not.toBeInTheDocument();
  });

  it("foreign risk attribution line carries the read-only lock in the meta row", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[foreignRisk]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
        />
      </SdlcTooltipProvider>,
    );

    // The author-attribution meta row marks a foreign risk as read-only.
    const lockImgs = screen.getAllByRole("img", { name: /Read-only/i });
    expect(lockImgs.length).toBeGreaterThanOrEqual(1);
  });

  it("own risk card does not render LockBadge", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[{ ...foreignRisk, foreign: false, authorName: "Alice" }]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.queryByRole("img", { name: /Read-only/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Edit risk/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete risk/i }),
    ).toBeInTheDocument();

    // The row icon buttons floor at the touch target below `md` while keeping
    // the 34px desktop density; jsdom cannot evaluate media queries, so the
    // class assertions are the teeth.
    for (const name of [/Edit risk/i, /Delete risk/i]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("min-w-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[34px]");
      expect(button.className).toContain("md:min-w-[34px]");
    }
  });

  it("falls back to sectionAuthorName when risk.authorName is absent", () => {
    // risk.authorName is absent — LockBadge must show sectionAuthorName, not
    // the current user's name.
    const riskWithoutAuthor: RiskEntry = {
      ...foreignRisk,
      authorName: undefined,
    };

    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[riskWithoutAuthor]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
          sectionAuthorName="Bob"
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.getByLabelText("Read-only — authored by Bob"),
    ).toBeInTheDocument();
  });
});

describe("RisksSection — aria-hidden decorative icons", () => {
  it("Edit button has correct aria-label and its child SVG has aria-hidden='true'", () => {
    render(<RisksSection risks={[baseRisk]} />);

    const editBtn = screen.getByRole("button", {
      name: `Edit risk for ${baseRisk.productName}`,
    });
    expect(editBtn).toHaveAttribute(
      "aria-label",
      `Edit risk for ${baseRisk.productName}`,
    );
    const svg = editBtn.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Delete button has correct aria-label and its child SVG has aria-hidden='true'", () => {
    render(<RisksSection risks={[baseRisk]} />);

    const deleteBtn = screen.getByRole("button", {
      name: `Delete risk for ${baseRisk.productName}`,
    });
    expect(deleteBtn).toHaveAttribute(
      "aria-label",
      `Delete risk for ${baseRisk.productName}`,
    );
    const svg = deleteBtn.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("RisksSection stage scope", () => {
  it("renders explicit all-stage selection as stage chips, not All stages", () => {
    render(
      <RisksSection
        risks={[{ ...baseRisk, stageNames: ["Development", "Testing"] }]}
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("does not render a warning for omitted product stage scope", () => {
    render(<RisksSection risks={[{ ...baseRisk, stageNames: [] }]} />);

    expect(screen.queryByText("No stage set")).not.toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
  });

  it("renders the explicit stage scope", () => {
    render(
      <RisksSection risks={[{ ...baseRisk, stageNames: ["Development"] }]} />,
    );

    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("No stage set")).not.toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
  });

  it("renders every explicit stage without compacting", () => {
    render(
      <RisksSection
        risks={[
          {
            ...baseRisk,
            stageNames: ["Planning", "Analysis", "Design", "Development"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});

describe("RisksSection — severity toggle", () => {
  it("flips a blocked risk to at-risk in one click and calls onChange", () => {
    const onChange = vi.fn<(next: readonly RiskEntry[]) => void>();
    render(
      <RisksSection
        risks={[{ ...baseRisk, severity: "blocked" }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Downgrade risk for CRM to at risk/i,
      }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]?.[0]?.severity).toBe("at-risk");
  });

  it("escalates an at-risk risk to blocked in one click", () => {
    const onChange = vi.fn<(next: readonly RiskEntry[]) => void>();
    render(
      <RisksSection
        risks={[{ ...baseRisk, severity: "at-risk" }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Escalate risk for CRM to blocked/i }),
    );

    expect(onChange.mock.calls[0]?.[0]?.[0]?.severity).toBe("blocked");
  });

  it("shows no severity toggle on a foreign (read-only) risk card", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[foreignRisk]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /Downgrade risk|Escalate risk/i }),
    ).not.toBeInTheDocument();
  });
});

describe("RisksSection — readOnly raise-prefill (C3044)", () => {
  it("a raise signal arriving under readOnly opens nothing and leaves no prefill for the next plain +Add", () => {
    const prefill = {
      signal: 1,
      productId: "p1",
      stageNames: [],
      severity: "blocked" as const,
    };
    const { rerender } = render(
      <RisksSection
        risks={[]}
        products={[
          { id: "p1", name: "Product", overallStatus: "on-track", stages: [] },
        ]}
        addPrefill={prefill}
        readOnly
      />,
    );

    // Existing readOnly contract: the dialog never opens while read-only.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // A later plain +Add back in editable mode must open blank — the
    // readOnly-window signal must not leak its severity into the create form.
    rerender(
      <RisksSection
        risks={[]}
        products={[
          { id: "p1", name: "Product", overallStatus: "on-track", stages: [] },
        ]}
        addPrefill={prefill}
        readOnly={false}
        addSignal={1}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Blocked" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "At risk" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("RisksSection — foreign stage nudge (C5142)", () => {
  it("a stage-less foreign card on a flagged product shows no actionable nudge but keeps its lock disclosure", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[{ ...foreignRisk, stageNames: [] }]}
          products={[
            { id: "p1", name: "Product", overallStatus: "at-risk", stages: [] },
          ]}
        />
      </SdlcTooltipProvider>,
    );

    // The nudge implies an edit the viewer cannot take (LockBadge, no actions).
    expect(
      screen.queryByText(/Select at least one stage/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Read-only — authored by Alice"),
    ).toBeInTheDocument();
  });
});

describe("RisksSection — empty product name labels (C5144)", () => {
  it.each(["", " ".repeat(3)])(
    "names toggle/edit/delete actions with a fallback for productName %s",
    (productName) => {
      const { unmount } = render(
        <RisksSection risks={[{ ...baseRisk, productName }]} />,
      );

      expect(
        screen.getByRole("button", { name: "Edit risk for untitled" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Escalate risk for untitled to blocked",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete risk for untitled" }),
      ).toBeInTheDocument();
      unmount();
    },
  );
});
