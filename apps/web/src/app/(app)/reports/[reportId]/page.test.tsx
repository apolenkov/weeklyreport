// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewerReportShellMock = vi.hoisted(() =>
  vi.fn((props: { reportId: string; mode: string; authorId?: string }) => (
    <div
      data-testid="viewer-report-shell"
      data-report-id={props.reportId}
      data-mode={props.mode}
      data-author-id={props.authorId ?? ""}
    />
  )),
);

vi.mock("../../../../features/viewer/ui/viewer-report-shell", () => ({
  ViewerReportShell: viewerReportShellMock,
}));

vi.mock("../../../../features/report-pages", () => ({
  WeeklyReportSkeleton: () => <div data-testid="weekly-report-skeleton" />,
}));

import PublishedReportPage from "./page";

const REPORT_ID = "report-xyz-999";

async function renderPage(searchParams: {
  mode?: string | string[];
  authorId?: string | string[];
}): Promise<void> {
  const element = await PublishedReportPage({
    params: Promise.resolve({ reportId: REPORT_ID }),
    searchParams: Promise.resolve(searchParams),
  });
  render(element);
}

describe("PublishedReportPage — mode mapping", () => {
  beforeEach(() => {
    viewerReportShellMock.mockClear();
  });

  it("maps ?mode=slides to the shell's slides mode", async () => {
    await renderPage({ mode: "slides" });
    const shell = screen.getByTestId("viewer-report-shell");
    expect(shell).toHaveAttribute("data-mode", "slides");
    expect(shell).toHaveAttribute("data-report-id", REPORT_ID);
  });

  it("defaults to form mode and passes an absent authorId as undefined", async () => {
    await renderPage({});
    expect(screen.getByTestId("viewer-report-shell")).toHaveAttribute(
      "data-mode",
      "form",
    );
    expect(viewerReportShellMock.mock.lastCall?.[0]).toMatchObject({
      authorId: undefined,
    });
  });

  it("maps an unknown mode value to form mode and threads authorId", async () => {
    await renderPage({ mode: "bogus", authorId: "author-7" });
    const shell = screen.getByTestId("viewer-report-shell");
    expect(shell).toHaveAttribute("data-mode", "form");
    expect(shell).toHaveAttribute("data-author-id", "author-7");
  });

  it("rejects repeated mode and authorId values instead of weakening their types", async () => {
    await renderPage({
      mode: ["slides", "form"],
      authorId: ["author-7", "author-8"],
    });
    expect(viewerReportShellMock.mock.lastCall?.[0]).toMatchObject({
      mode: "form",
      authorId: undefined,
    });
  });
});
