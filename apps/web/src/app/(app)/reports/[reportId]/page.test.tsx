/**
 * @vitest-environment jsdom
 *
 * viewer-report-surface-parity (review P3): the published-report server page
 * maps `?mode=slides` to the viewer shell's slides mode and everything else to
 * form mode. This pins that mapping (and the reportId/authorId pass-through)
 * via a captured-prop assertion on a stubbed ViewerReportShell.
 */

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../features/viewer/ui/viewer-report-shell", () => ({
  ViewerReportShell: (props: {
    reportId: string;
    mode: string;
    authorId?: string;
  }) => (
    <div
      data-testid="viewer-report-shell"
      data-report-id={props.reportId}
      data-mode={props.mode}
      data-author-id={props.authorId ?? ""}
    />
  ),
}));

vi.mock("../../../../components/weekly-report/weekly-report-skeleton", () => ({
  WeeklyReportSkeleton: () => <div data-testid="weekly-report-skeleton" />,
}));

import PublishedReportPage from "./page";

const REPORT_ID = "report-xyz-999";

async function renderPage(searchParams: {
  mode?: string;
  authorId?: string;
}): Promise<void> {
  const element = await PublishedReportPage({
    params: Promise.resolve({ reportId: REPORT_ID }),
    searchParams: Promise.resolve(searchParams),
  });
  render(element);
}

describe("PublishedReportPage — mode mapping", () => {
  it("maps ?mode=slides to the shell's slides mode", async () => {
    await renderPage({ mode: "slides" });
    const shell = screen.getByTestId("viewer-report-shell");
    expect(shell).toHaveAttribute("data-mode", "slides");
    expect(shell).toHaveAttribute("data-report-id", REPORT_ID);
  });

  it("defaults to form mode when no mode param is present", async () => {
    await renderPage({});
    expect(screen.getByTestId("viewer-report-shell")).toHaveAttribute(
      "data-mode",
      "form",
    );
  });

  it("maps an unknown mode value to form mode and threads authorId", async () => {
    await renderPage({ mode: "bogus", authorId: "author-7" });
    const shell = screen.getByTestId("viewer-report-shell");
    expect(shell).toHaveAttribute("data-mode", "form");
    expect(shell).toHaveAttribute("data-author-id", "author-7");
  });
});
