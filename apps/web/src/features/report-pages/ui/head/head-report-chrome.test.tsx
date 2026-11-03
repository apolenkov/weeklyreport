// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../period", () => ({
  HeadPublishLockAction: () => null,
  PeriodNavigationSkeleton: ({ testId }: { testId: string }) => (
    <div data-testid={testId} />
  ),
  PeriodNavigator: ({ urlBuilder }: { urlBuilder: (id: string) => string }) => (
    <a href={urlBuilder("next-period")}>Next period</a>
  ),
}));
vi.mock("../../../../shared/ui/report-shell/scope-toggle", () => ({
  ScopeToggle: () => null,
}));
vi.mock("../../../../shared/ui/report-shell/view-mode-toggle", () => ({
  ViewModeToggle: () => null,
}));

import {
  HEAD_DEPARTMENT_LABEL,
  HeadContextControls,
} from "./head-report-chrome";

it("uses lifecycle-neutral portfolio context", () => {
  render(HEAD_DEPARTMENT_LABEL);
  expect(screen.getByText("Portfolio report")).toBeInTheDocument();
});

describe("HeadContextControls", () => {
  it("clears Review intent in period destinations", () => {
    const buildQuery = (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams("review=1&scope=lead&authorId=ada");
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      return `?${params.toString()}`;
    };
    render(
      <HeadContextControls
        periods={[{} as never]}
        reportId="r1"
        mode="form"
        urlState={
          {
            buildQuery,
            includeArchive: false,
            setIncludeArchive: () => undefined,
          } as never
        }
        historyError={false}
        historyLoading={false}
        historyTruncated={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Next period" })).toHaveAttribute(
      "href",
      "/head/report/next-period?scope=lead&authorId=ada",
    );
  });
  it.each([true, false])(
    "discloses compiled history truncation=%s",
    (truncated) => {
      render(
        <HeadContextControls
          periods={[]}
          reportId="r1"
          mode="form"
          urlState={
            {
              buildQuery: () => "",
              includeArchive: false,
              setIncludeArchive: () => undefined,
            } as never
          }
          historyError={false}
          historyLoading={false}
          historyTruncated={truncated}
        />,
      );
      if (truncated) {
        expect(screen.getByRole("status")).toHaveTextContent(
          "Showing the latest 100 periods.",
        );
      } else {
        expect(
          screen.queryByText("Showing the latest 100 periods."),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("lets the period row wrap so a 375 px viewport never scrolls sideways", () => {
    render(
      <HeadContextControls
        periods={[]}
        reportId="r1"
        mode="form"
        urlState={
          {
            buildQuery: () => "",
            includeArchive: false,
            setIncludeArchive: () => undefined,
          } as never
        }
        historyTruncated={false}
        historyError={false}
        historyLoading
      />,
    );

    const row = screen.getByTestId(
      "head-period-navigation-skeleton",
    ).parentElement;
    expect(row).toHaveClass("flex-wrap", "min-w-0", "max-w-full");
    expect(row).not.toHaveClass("min-w-max");
  });
});
