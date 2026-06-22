/**
 * @vitest-environment jsdom
 *
 * head-toolbar-semantics: the view mode is a ROUTE concern — the page parses
 * `?mode=slides` from the URL into the `mode` prop the shell reflects. This is
 * the URL→mode "restore" half of the spec's "refresh preserves the view state"
 * scenario (the component-side reflection is covered in head-report-shell.test).
 */

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the shell so the test observes only which `mode` the route resolves and
// passes down (the shell's own behavior is tested separately).
vi.mock("../../../../../components/head/head-report-shell", () => ({
  HeadReportShell: ({
    mode,
    reportId,
    authorId,
  }: {
    mode: "form" | "slides";
    reportId: string;
    authorId?: string;
  }) => (
    <div
      data-testid="shell"
      data-mode={mode}
      data-report={reportId}
      data-author={authorId ?? ""}
    />
  ),
}));

import HeadReportByIdPage from "./page";

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";

async function renderPage(searchParams: { mode?: string; authorId?: string }) {
  const ui = await HeadReportByIdPage({
    params: Promise.resolve({ reportId: REPORT_ID }),
    searchParams: Promise.resolve(searchParams),
  });
  render(ui);
  return screen.getByTestId("shell");
}

describe("HeadReportByIdPage — URL → view-mode mapping", () => {
  it("maps ?mode=slides to the slides mode", async () => {
    const shell = await renderPage({ mode: "slides" });
    expect(shell).toHaveAttribute("data-mode", "slides");
    expect(shell).toHaveAttribute("data-report", REPORT_ID);
  });

  it("defaults to form mode when mode is absent", async () => {
    const shell = await renderPage({});
    expect(shell).toHaveAttribute("data-mode", "form");
  });

  it("treats any non-slides mode value as form", async () => {
    const shell = await renderPage({ mode: "bogus" });
    expect(shell).toHaveAttribute("data-mode", "form");
  });

  it("threads the authorId through to the shell", async () => {
    const shell = await renderPage({ authorId: "lead-7" });
    expect(shell).toHaveAttribute("data-author", "lead-7");
  });
});
