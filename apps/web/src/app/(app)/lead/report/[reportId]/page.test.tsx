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
  readonly mode?: string | string[];
  readonly feedback?: string | string[];
  readonly feedbackUrl?: string | string[];
  readonly agentationSession?: string | string[];
  readonly agentationAnnotation?: string | string[];
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

  it("canonicalizes legacy edit mode to the Report URL", async () => {
    await renderPage({ mode: "edit" });
    expect(redirect).toHaveBeenCalledWith(`/lead/report/${REPORT_ID}`);
  });

  it("canonicalizes legacy edit mode without losing feedback focus", async () => {
    await renderPage({
      mode: "edit",
      feedback: "feedback-7",
      feedbackUrl: "/lead/report",
    });

    expect(redirect).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}?feedback=feedback-7&feedbackUrl=%2Flead%2Freport`,
    );
  });

  it("preserves explicit Slides mode", async () => {
    expect(await renderPage({ mode: "slides" })).toHaveAttribute(
      "data-mode",
      "slides",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("canonicalizes an unknown mode without losing feedback focus", async () => {
    await renderPage({
      mode: "unknown",
      feedback: "feedback-7",
      feedbackUrl: "/lead/report",
    });

    expect(redirect).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}?feedback=feedback-7&feedbackUrl=%2Flead%2Freport`,
    );
  });

  it("canonicalizes an unknown mode without losing Agentation focus", async () => {
    await renderPage({
      mode: "unknown",
      agentationSession: "session-7",
      agentationAnnotation: "annotation-9",
    });

    expect(redirect).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}?agentationSession=session-7&agentationAnnotation=annotation-9`,
    );
  });

  it("ignores repeated mode values without redirecting", async () => {
    expect(await renderPage({ mode: ["slides", "overview"] })).toHaveAttribute(
      "data-mode",
      "overview",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("drops repeated focus values while preserving scalar focus", async () => {
    await renderPage({
      mode: "unknown",
      feedback: ["feedback-7", "feedback-8"],
      feedbackUrl: "/lead/report",
    });

    expect(redirect).toHaveBeenCalledWith(
      `/lead/report/${REPORT_ID}?feedbackUrl=%2Flead%2Freport`,
    );
  });
});
