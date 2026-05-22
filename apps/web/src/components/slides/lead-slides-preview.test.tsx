import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadSlidesPreview } from "./lead-slides-preview";
import { createDemoSection } from "../../test/fixtures";

describe("LeadSlidesPreview", () => {
  it("shows the empty hint when there is no section", () => {
    render(<LeadSlidesPreview section={null} />);
    expect(screen.getByText("Slide preview")).toBeInTheDocument();
    expect(
      screen.getByText(/Fill in products, items, risks, or decisions/i),
    ).toBeInTheDocument();
  });

  it("renders a live deck built from the draft section (no fetch)", () => {
    render(<LeadSlidesPreview section={createDemoSection()} />);
    // A populated section takes the deck branch, not the empty hint.
    expect(
      screen.queryByText(/Fill in products, items, risks, or decisions/i),
    ).not.toBeInTheDocument();
  });
});
