/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
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
  it("EditIcon SVG has aria-hidden='true'", () => {
    render(<RisksSection risks={[baseRisk]} />);

    const editBtn = screen.getByRole("button", { name: /Edit risk for CRM/i });
    const svg = editBtn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("DeleteIcon SVG has aria-hidden='true'", () => {
    render(<RisksSection risks={[baseRisk]} />);

    const deleteBtn = screen.getByRole("button", {
      name: /Delete risk for CRM/i,
    });
    const svg = deleteBtn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

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

  it("snapshot: Edit and Delete buttons with decorative aria-hidden SVGs", () => {
    render(<RisksSection risks={[baseRisk]} />);

    const editBtn = screen.getByRole("button", {
      name: /Edit risk for CRM/i,
    });
    const deleteBtn = screen.getByRole("button", {
      name: /Delete risk for CRM/i,
    });
    expect(editBtn).toMatchInlineSnapshot(`
      <button
        aria-label="Edit risk for CRM"
        class="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
        type="button"
      >
        <svg
          aria-hidden="true"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
          />
          <path
            d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
          />
        </svg>
      </button>
    `);
    expect(deleteBtn).toMatchInlineSnapshot(`
      <button
        aria-label="Delete risk for CRM"
        class="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] md:min-h-[34px] md:min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
        type="button"
      >
        <svg
          aria-hidden="true"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
          />
        </svg>
      </button>
    `);
  });
});

describe("RisksSection stage scope", () => {
  it("renders explicit all-stage selection as stage chips, not All stages", () => {
    render(
      <RisksSection
        risks={[{ ...baseRisk, stageNames: ["Dev", "Testing"] }]}
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering.
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("renders a No-stage-set warning chip for omitted stage scope", () => {
    // A risk with no stages is a legacy anomaly, never an implicit "all stages"
    // scope — the card must say so loudly.
    render(<RisksSection risks={[baseRisk]} />);

    expect(screen.getByText("No stage set")).toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
  });

  it("resolves the legacy stageName fallback before warning", () => {
    render(
      <RisksSection risks={[{ ...baseRisk, stageName: "Development" }]} />,
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
            stageNames: ["Planning", "Analysis", "Design", "Dev"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering.
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});

describe("RisksSection — severity toggle", () => {
  it("flips a blocked risk to at-risk in one click and calls onChange", () => {
    const onChange = vi.fn<(next: RiskEntry[]) => void>();
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
    const onChange = vi.fn<(next: RiskEntry[]) => void>();
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
