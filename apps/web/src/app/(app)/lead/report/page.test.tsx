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

async function renderPage(mode?: string | string[]) {
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

  it("normalizes the legacy edit mode to Overview", async () => {
    expect(await renderPage("edit")).toHaveAttribute("data-mode", "overview");
  });

  it("preserves explicit Slides mode", async () => {
    expect(await renderPage("slides")).toHaveAttribute("data-mode", "slides");
  });

  it("maps unknown modes to Overview", async () => {
    expect(await renderPage("unknown")).toHaveAttribute(
      "data-mode",
      "overview",
    );
  });

  it("ignores repeated mode values", async () => {
    expect(await renderPage(["slides", "overview"])).toHaveAttribute(
      "data-mode",
      "overview",
    );
  });
});
