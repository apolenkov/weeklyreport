// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../features/report-pages", () => ({
  WeeklyReportPage: ({ authorId }: { authorId?: string }) => (
    <div data-testid="report-page" data-author={authorId ?? ""} />
  ),
}));

import HeadReportPage from "./page";

async function renderPage(authorId?: string | string[]) {
  render(
    await HeadReportPage({
      searchParams: Promise.resolve(authorId === undefined ? {} : { authorId }),
    }),
  );
  return screen.getByTestId("report-page");
}

describe("HeadReportPage — query parameters", () => {
  it("preserves a scalar author deep link", async () => {
    expect(await renderPage("lead-7")).toHaveAttribute("data-author", "lead-7");
  });

  it("ignores repeated author values", async () => {
    expect(await renderPage(["lead-7", "lead-8"])).toHaveAttribute(
      "data-author",
      "",
    );
  });
});
