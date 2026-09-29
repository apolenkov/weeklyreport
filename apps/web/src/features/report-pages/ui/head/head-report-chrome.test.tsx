// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../period", () => ({
  HeadPublishLockAction: () => null,
  PeriodNavigationSkeleton: ({ testId }: { testId: string }) => (
    <div data-testid={testId} />
  ),
  PeriodNavigator: () => null,
}));
vi.mock("../../../../shared/ui/report-shell/scope-toggle", () => ({
  ScopeToggle: () => null,
}));
vi.mock("../../../../shared/ui/report-shell/view-mode-toggle", () => ({
  ViewModeToggle: () => null,
}));

import { HeadContextControls } from "./head-report-chrome";

describe("HeadContextControls", () => {
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
