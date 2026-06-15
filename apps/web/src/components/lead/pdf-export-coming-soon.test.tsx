/**
 * @vitest-environment jsdom
 *
 * deferred-feature-pattern: the lead Export-PDF control is a UI-deferred
 * ComingSoon control — inert, never wired to pdfExport.request. Lead is
 * FORBIDDEN from the real export path (role-coverage-gate).
 */

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PdfExportComingSoonControl } from "./pdf-export-coming-soon";

describe("PdfExportComingSoonControl", () => {
  it("renders an inert, aria-disabled control with a descriptive label", () => {
    render(<PdfExportComingSoonControl />);
    const control = screen.getByTestId("lead-pdf-export-coming-soon");
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("aria-label", "PDF export is coming soon");
    expect(control).toHaveAttribute("title", "Coming Soon");
    // The control must be a button that never submits the surrounding form and
    // carries no click handler that could reach a backend call.
    expect(control.tagName).toBe("BUTTON");
    expect(control).toHaveAttribute("type", "button");
  });

  it("carries the coming-soon tooltip", () => {
    render(<PdfExportComingSoonControl />);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
