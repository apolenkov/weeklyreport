// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../features/pdf-export", () => ({
  PdfRecoverySection: () => <div data-testid="pdf-recovery-section" />,
}));

import PdfExportsPage from "./page";

describe("PdfExportsPage", () => {
  it("renders the shared recovery section on a focusable main target", async () => {
    render(await PdfExportsPage());

    expect(screen.getByTestId("pdf-recovery-section")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "PDF exports" }),
    ).toBeInTheDocument();
  });
});
