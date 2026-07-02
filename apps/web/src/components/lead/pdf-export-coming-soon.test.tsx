/**
 * @vitest-environment jsdom
 *
 * deferred-feature-pattern: the lead Export-PDF control is a UI-deferred
 * ComingSoon control — inert, never wired to pdfExport.request. Lead is
 * FORBIDDEN from the real export path (role-coverage-gate).
 */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PdfExportComingSoonControl } from "./pdf-export-coming-soon";

describe("PdfExportComingSoonControl", () => {
  it("renders an inert, aria-disabled control with a descriptive label", () => {
    render(<PdfExportComingSoonControl />);
    const control = screen.getByTestId("lead-pdf-export-coming-soon");
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("aria-label", "PDF export is coming soon");
    // No native title — the aria-label carries the name and the amber
    // ComingSoonBadge renders the visual tooltip. A stacked title="Coming Soon"
    // would double the tooltip on hover (see coming-soon-style.test.tsx).
    expect(control).not.toHaveAttribute("title");
    // The control must be a button that never submits the surrounding form and
    // carries no click handler that could reach a backend call.
    expect(control.tagName).toBe("BUTTON");
    expect(control).toHaveAttribute("type", "button");
  });

  it("derives its circle size from the shared toolbar token like its siblings", () => {
    // responsive-compact-layout: the token is 32px on desktop and rises to the
    // touch-target floor below `md` — a hard-coded h-8/w-8 would stay 32px on
    // phones while every sibling circle grows.
    render(<PdfExportComingSoonControl />);
    const control = screen.getByTestId("lead-pdf-export-coming-soon");
    expect(control.className).toContain("h-[var(--toolbar-control-h)]");
    expect(control.className).toContain("w-[var(--toolbar-control-h)]");
  });

  it("opens the coming-soon tooltip on focus, via the Radix portal", async () => {
    render(<PdfExportComingSoonControl />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByTestId("lead-pdf-export-coming-soon"));

    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });
});
