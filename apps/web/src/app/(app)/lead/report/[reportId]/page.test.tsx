// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../../../../features/report-pages", () => ({
  LeadForm: ({
    mode,
    reportId,
  }: {
    readonly mode: string;
    readonly reportId: string;
  }) => (
    <div data-testid="lead-form" data-mode={mode} data-report-id={reportId} />
  ),
  LeadFormSkeleton: ({ mode }: { readonly mode: string }) => (
    <div data-testid="lead-form-skeleton" data-mode={mode} />
  ),
}));

import LeadReportByIdPage from "./page";

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";

async function renderPage(searchParams: {
  readonly mode?: string;
  readonly siteping?: string;
  readonly sitepingUrl?: string;
}) {
  render(
    await LeadReportByIdPage({
      params: Promise.resolve({ reportId: REPORT_ID }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
  return screen.getByTestId("lead-form");
}

describe("LeadReportByIdPage — URL mode", () => {
  beforeEach(() => redirect.mockClear());

  it("defaults the addressed route to Overview", async () => {
    const form = await renderPage({});
    expect(form).toHaveAttribute("data-mode", "overview");
    expect(form).toHaveAttribute("data-report-id", REPORT_ID);
  });

  it.each(["edit", "slides"] as const)(
    "preserves explicit %s mode",
    async (mode) => {
      expect(await renderPage({ mode })).toHaveAttribute("data-mode", mode);
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it("canonicalizes an unknown mode without losing SitePing focus", async () => {
    await renderPage({
      mode: "unknown",
      siteping: "feedback-7",
      sitepingUrl: "/lead/report",
    });

    expect(redirect).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}?siteping=feedback-7&sitepingUrl=%2Flead%2Freport`,
    );
  });
});
