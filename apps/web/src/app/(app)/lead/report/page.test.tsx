// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../features/report-pages", () => ({
  LeadForm: ({ mode }: { readonly mode: string }) => (
    <div data-testid="lead-form" data-mode={mode} />
  ),
  LeadFormSkeleton: ({ mode }: { readonly mode: string }) => (
    <div data-testid="lead-form-skeleton" data-mode={mode} />
  ),
}));

import LeadReportPage from "./page";

async function renderPage(mode?: string) {
  render(
    await LeadReportPage({
      searchParams: Promise.resolve(mode === undefined ? {} : { mode }),
    }),
  );
  return screen.getByTestId("lead-form");
}

describe("LeadReportPage — URL mode", () => {
  it("defaults the bare route to Overview", async () => {
    expect(await renderPage()).toHaveAttribute("data-mode", "overview");
  });

  it.each(["edit", "slides"] as const)(
    "preserves explicit %s mode",
    async (mode) => {
      expect(await renderPage(mode)).toHaveAttribute("data-mode", mode);
    },
  );

  it("maps unknown modes to Overview", async () => {
    expect(await renderPage("unknown")).toHaveAttribute(
      "data-mode",
      "overview",
    );
  });
});
