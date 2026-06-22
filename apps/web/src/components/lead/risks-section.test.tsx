/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
import type { RiskEntry } from "./mock-data";
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

describe("RisksSection LockBadge (Phase 3.8)", () => {
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
  });

  it("falls back to sectionAuthorName when risk.authorName is absent (T2 fix)", () => {
    // risk.authorName is absent — LockBadge must show sectionAuthorName, not the
    // current user's name. Before the fix, lead-form.tsx passed currentUser.name
    // as sectionAuthorName, causing the badge to show the wrong person.
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

// ---------------------------------------------------------------------------
// VA-0a/VA-0b — a11y regression catalog
// Source: openspec/changes/verify-a11y-recommended-flip/design.md
// Section: apps/web/src/components/lead/risks-section.tsx
// Rows: EditIcon SVG aria-hidden, DeleteIcon SVG aria-hidden,
//       Edit button + child SVG, Delete button + child SVG,
//       snapshot: decorative icon accessibility
// ---------------------------------------------------------------------------

describe("RisksSection — VA-0a/VA-0b a11y (aria-hidden decorative icons)", () => {
  // baseRisk from above: non-foreign, readOnly=false — both action buttons render.

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
        class="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
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
        class="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
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
        risks={[{ ...baseRisk, stageIds: ["Dev", "Testing"] }]}
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering (L4 fix).
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("renders a No-stage-set warning chip for omitted stage scope (require-risk-stage)", () => {
    // New contract: a risk with no stages is a legacy anomaly, never an
    // implicit "all stages" scope — the card must say so loudly.
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
            stageIds: ["Planning", "Analysis", "Design", "Dev"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering (L4 fix).
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});

describe("RisksSection — slide-capacity advisory (add-slide-capacity-signals)", () => {
  function manyRisks(n: number): RiskEntry[] {
    return Array.from({ length: n }, (_, i) => ({
      ...baseRisk,
      id: `risk-${String(i)}`,
      productId: "product-1",
      productName: "CRM",
    }));
  }

  it("renders a single advisory when one product exceeds the soft cap (once per group)", () => {
    render(<RisksSection risks={manyRisks(6)} />);

    const notes = screen.getAllByTestId("slide-fit-advisory");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent(
      "6 records may not fit cleanly on the slide",
    );
  });

  it("renders no advisory when the product is at or under the soft cap", () => {
    render(<RisksSection risks={manyRisks(5)} />);

    expect(screen.queryByTestId("slide-fit-advisory")).not.toBeInTheDocument();
  });
});
